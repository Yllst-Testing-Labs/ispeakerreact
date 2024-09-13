import { isElectron } from "./isElectron";

let db;

// Helper function to convert Blob to ArrayBuffer
async function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(blob);
    });
}

// Open IndexedDB database
export function openDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = window.indexedDB.open("iSpeaker_data", 1);

        request.onerror = function (event) {
            console.error("Database error: ", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = function (event) {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("recording_data")) {
                db.createObjectStore("recording_data", { keyPath: "id" });
            }
        };
    });
}

// Save recording to either Electron or IndexedDB
export async function saveRecording(blob, key) {
    const arrayBuffer = await blobToArrayBuffer(blob);

    if (isElectron()) {
        // Electron environment
        try {
            await window.electron.saveRecording(key, arrayBuffer);
            console.log("Recording saved successfully via Electron API");
        } catch (error) {
            console.error("Error saving recording in Electron:", error);
        }
    } else {
        // Browser environment with IndexedDB
        try {
            const db = await openDatabase();
            if (!db) return;

            const transaction = db.transaction(["recording_data"], "readwrite");
            const store = transaction.objectStore("recording_data");

            const request = store.put({ id: key, recording: arrayBuffer });

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log("Recording saved successfully to IndexedDB");
                    resolve();
                };
                request.onerror = (error) => {
                    console.error("Error saving recording:", error);
                    reject(error);
                };
            });
        } catch (error) {
            console.error("Error saving recording to IndexedDB:", error);
        }
    }
}

// Check if recording exists
export async function checkRecordingExists(key) {
    if (isElectron()) {
        return window.electron.checkRecordingExists(key);
    } else {
        try {
            const db = await openDatabase();
            if (!db) return false;

            const transaction = db.transaction(["recording_data"]);
            const store = transaction.objectStore("recording_data");
            const request = store.get(key);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    if (request.result) resolve(true);
                    else resolve(false);
                };
                request.onerror = (error) => reject(error);
            });
        } catch (error) {
            console.error("Error checking recording existence in IndexedDB:", error);
            return false;
        }
    }
}

// Play recording from either Electron or IndexedDB
export async function playRecording(key, onSuccess, onError, onEnded) {
    if (isElectron()) {
        try {
            // Get the audio data as an ArrayBuffer from the main process
            const arrayBuffer = await window.electron.playRecording(key);

            // Create a Blob from the ArrayBuffer
            const audioBlob = new Blob([arrayBuffer], { type: "audio/wav" });

            // Create a Blob URL
            const blobUrl = URL.createObjectURL(audioBlob);

            console.log("Blob URL:", blobUrl);

            // Use the Blob URL for audio playback
            const audio = new Audio(blobUrl);
            audio.onended = () => {
                // Revoke the Blob URL after playback to free up memory
                URL.revokeObjectURL(blobUrl);
                if (onEnded) onEnded();
            };
            audio.onerror = (error) => {
                // Revoke the Blob URL in case of an error
                URL.revokeObjectURL(blobUrl);
                if (onError) onError(error);
            };

            // Play the audio
            await audio.play();

            // Call success callback
            if (onSuccess) onSuccess(audio, null);
        } catch (error) {
            console.error("Error playing audio file in Electron:", error);

            // Call error callback
            if (onError) onError(error);
        }
    } else {
        // Browser environment with IndexedDB
        try {
            const db = await openDatabase();
            if (!db) return;

            const transaction = db.transaction(["recording_data"]);
            const store = transaction.objectStore("recording_data");
            const request = store.get(key);

            request.onsuccess = async function () {
                const { recording, mimeType } = request.result;

                try {
                    // Use AudioContext for playback
                    const audioContext = new AudioContext();
                    const buffer = await audioContext.decodeAudioData(recording);
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);

                    source.onended = onEnded;
                    source.start();

                    if (onSuccess) onSuccess(null, source);
                } catch (decodeError) {
                    console.error("Error decoding audio data:", decodeError);

                    // Fallback to Blob URL
                    const audioBlob = new Blob([recording], { type: mimeType });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);

                    audio.onended = onEnded;
                    audio.onerror = onError;

                    audio
                        .play()
                        .then(() => {
                            if (onSuccess) onSuccess(audio, null);
                        })
                        .catch((playError) => {
                            console.error("Error playing audio via Blob URL:", playError);
                            if (onError) onError(playError);
                        });
                }
            };

            request.onerror = (error) => {
                console.error("Error retrieving recording from IndexedDB:", error);
                if (onError) onError(error);
            };
        } catch (error) {
            console.error("Error playing recording from IndexedDB:", error);
            if (onError) onError(error);
        }
    }
}
