import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { saveRecording } from "../../utils/databaseOperations";
import { isElectron } from "../../utils/isElectron";

export function useRecordingFunction(
    activeRecordingCard,
    setActiveRecordingCard,
    setIsRecording,
    setMediaRecorder,
    setToastMessage,
    setShowToast,
    setRecordingAvailability,
    isRecording,
    mediaRecorder,
    findPhonemeDetails,
    sound,
    accent,
    recordingAvailability,
    playingRecordings
) {
    const { t } = useTranslation();
    const MAX_RECORDING_DURATION_MS = 20 * 1000; // 20 seconds in milliseconds

    const getRecordingKey = useCallback(
        (cardIndex) => {
            const { index, type } = findPhonemeDetails(sound.phoneme);
            return `${accent}-${type}${index + 1}_${cardIndex}`;
        },
        [findPhonemeDetails, sound.phoneme, accent] // Dependencies array
    );

    const handleRecording = useCallback(
        (cardIndex) => {
            const recordingDataIndex = getRecordingKey(cardIndex);
            // Determine if a recording is starting or stopping
            if (activeRecordingCard !== cardIndex) {
                setActiveRecordingCard(cardIndex);
                // Start the recording process
                navigator.mediaDevices
                    .getUserMedia({ audio: true })
                    .then((stream) => {
                        const recordOptions = {
                            audioBitsPerSecond: 128000,
                        };
                        const mediaRecorder = new MediaRecorder(stream, recordOptions);
                        let audioChunks = [];
                        let mimeType = "";
                        let recordingStartTime = Date.now();

                        mediaRecorder.start();
                        setIsRecording(true);
                        setMediaRecorder(mediaRecorder);
                        setActiveRecordingCard(cardIndex);

                        mediaRecorder.addEventListener("dataavailable", (event) => {
                            audioChunks.push(event.data);

                            if (!mimeType && event.data && event.data.type) {
                                mimeType = event.data.type;
                                console.log("Captured MIME type:", mimeType);
                            }

                            // Check if the recording duration exceeds the time limit
                            const recordingDuration = Date.now() - recordingStartTime;
                            if (recordingDuration > MAX_RECORDING_DURATION_MS) {
                                mediaRecorder.stop();
                                setToastMessage(t("toast.recordingExceeded"));
                                setShowToast(true);
                                setIsRecording(false);
                                setActiveRecordingCard(null);
                            }

                            if (mediaRecorder.state === "inactive") {
                                const audioBlob = new Blob(audioChunks, { type: mimeType });
                                saveRecording(audioBlob, recordingDataIndex, mimeType);
                                setToastMessage(t("toast.recordingSuccess"));
                                setShowToast(true);
                                setRecordingAvailability((prev) => ({ ...prev, [recordingDataIndex]: true }));
                                audioChunks = [];
                            }
                        });

                        // Automatically stop recording after 10 minutes if not already stopped
                        setTimeout(() => {
                            if (mediaRecorder.state !== "inactive") {
                                mediaRecorder.stop();
                                setToastMessage(t("toast.recordingExceeded"));
                                setShowToast(true);
                                setIsRecording(false);
                                setActiveRecordingCard(null);
                            }
                        }, MAX_RECORDING_DURATION_MS);
                    })
                    .catch((err) => {
                        console.error("Error accessing the microphone.", err);
                        isElectron() && window.electron.log("error", `Error accessing the microphone: ${err}`);
                        setToastMessage(`${t("toast.recordingFailed")} ${err.message}`);
                        setShowToast(true);
                        setIsRecording(false);
                        setActiveRecordingCard(null);
                    });
            } else {
                // Stop recording if this cardIndex was already recording
                setActiveRecordingCard(null);
                // Stop the recording process
                if (isRecording) {
                    if (mediaRecorder) {
                        mediaRecorder.stop();
                        setIsRecording(false);
                        setActiveRecordingCard(null);
                    }
                }
            }
        },
        [
            MAX_RECORDING_DURATION_MS,
            activeRecordingCard,
            getRecordingKey,
            isRecording,
            mediaRecorder,
            setActiveRecordingCard,
            setIsRecording,
            setMediaRecorder,
            setToastMessage,
            setShowToast,
            setRecordingAvailability,
            t,
        ]
    );

    const isRecordingAvailable = useCallback(
        (cardIndex) => {
            const recordingKey = getRecordingKey(cardIndex);
            return recordingAvailability[recordingKey];
        },
        [getRecordingKey, recordingAvailability]
    );

    const isRecordingPlayingActive = useCallback(
        (cardIndex) => {
            const recordingKey = getRecordingKey(cardIndex);
            return !!playingRecordings[recordingKey];
        },
        [getRecordingKey, playingRecordings]
    );

    return { getRecordingKey, isRecordingPlayingActive, isRecordingAvailable, handleRecording };
}
