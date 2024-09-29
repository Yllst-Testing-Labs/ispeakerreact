import { useTranslation } from "react-i18next";
import { playRecording } from "../../utils/databaseOperations";
import { isElectron } from "../../utils/isElectron";

export function usePlaybackFunction(
    getRecordingKey,
    isRecordingPlaying,
    activePlaybackCard,
    currentAudioSource,
    setCurrentAudioSource,
    currentAudioElement,
    setCurrentAudioElement,
    setIsRecordingPlaying,
    setActivePlaybackCard,
    setPlayingRecordings,
    setToastMessage,
    setShowToast
) {
    const { t } = useTranslation();
    const handlePlayRecording = async (cardIndex) => {
        const key = getRecordingKey(cardIndex);

        if (isRecordingPlaying && activePlaybackCard === cardIndex) {
            // Stop current playback
            if (currentAudioSource) {
                currentAudioSource.stop();
                setCurrentAudioSource(null);
            }

            if (currentAudioElement) {
                currentAudioElement.pause();
                currentAudioElement.currentTime = 0;
                setCurrentAudioElement(null);
            }

            setIsRecordingPlaying(false);
            setActivePlaybackCard(null);
            setPlayingRecordings((prev) => ({ ...prev, [key]: false }));
        } else {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("Initial audioContext state: " + audioContext.state);

            if (audioContext.state === "suspended") {
                try {
                    await audioContext.resume(); // Resume within the event handler
                    console.log("AudioContext state after resume attempt: " + audioContext.state);

                    if (audioContext.state === "running") {
                        // Proceed with playback after resuming AudioContext
                        initiatePlayback(key, cardIndex, audioContext);
                    } else {
                        console.log("AudioContext did not resume. Fallback to Audio element.");
                        fallbackToAudioElement(key, cardIndex); // Handle iOS fallback
                    }
                } catch (error) {
                    console.error("Failed to resume AudioContext:", error);
                    setToastMessage("Error resuming audio playback: " + error.message);
                    setShowToast(true);
                }
            } else {
                // AudioContext is already running
                console.log("AudioContext is running, proceeding with playback.");
                initiatePlayback(key, cardIndex, audioContext);
            }
        }
    };

    // Fallback to Audio element on iOS
    const fallbackToAudioElement = (key, cardIndex) => {
        playRecording(
            key,
            (audio, audioSource) => {
                setIsRecordingPlaying(true);
                setActivePlaybackCard(cardIndex);
                setPlayingRecordings((prev) => ({ ...prev, [key]: true }));
                if (audioSource) {
                    setCurrentAudioSource(audioSource);
                } else {
                    setCurrentAudioElement(audio); // Handle Audio element playback
                }
            },
            (error) => {
                console.error("Error during playback:", error);
                isElectron() && window.electron.log("error", `Error during playback: ${error}`);
                setToastMessage(`${t("toast.playbackError")} ${error.message}`);
                setShowToast(true);
                setIsRecordingPlaying(false);
                setActivePlaybackCard(null);
                setPlayingRecordings((prev) => ({ ...prev, [key]: false }));
            },
            () => {
                setIsRecordingPlaying(false);
                setActivePlaybackCard(null);
                setPlayingRecordings((prev) => ({ ...prev, [key]: false }));
                setCurrentAudioSource(null);
                setCurrentAudioElement(null);
            },
            null // Do not pass audioContext, fallback to Blob URL
        );
    };

    const initiatePlayback = (key, cardIndex, audioContext) => {
        playRecording(
            key,
            (audio, audioSource) => {
                setIsRecordingPlaying(true);
                setActivePlaybackCard(cardIndex);
                setPlayingRecordings((prev) => ({ ...prev, [key]: true }));
                if (audioSource) {
                    setCurrentAudioSource(audioSource);
                } else {
                    setCurrentAudioElement(audio);
                }
            },
            (error) => {
                console.error("Error during playback:", error);
                isElectron() && window.electron.log("error", `Error during playback: ${error}`);
                setToastMessage(`${t("toast.playbackError")} ${error.message}`);
                setShowToast(true);
                setIsRecordingPlaying(false);
                setActivePlaybackCard(null);
                setPlayingRecordings((prev) => ({ ...prev, [key]: false }));
            },
            () => {
                setIsRecordingPlaying(false);
                setActivePlaybackCard(null);
                setPlayingRecordings((prev) => ({ ...prev, [key]: false }));
                setCurrentAudioSource(null);
                setCurrentAudioElement(null);
            },
            audioContext // Pass audioContext to playRecording
        );
    };

    // Fix for iOS < 17 playback issue due to AudioContext suspend
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const iOSVersion = isIOS && navigator.userAgent.match(/OS (\d+)_/);
    const iOSMajorVersion = iOSVersion ? parseInt(iOSVersion[1], 10) : null;

    if (isIOS && iOSMajorVersion && iOSMajorVersion < 17) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const resumeAudioContext = () => {
            if (audioContext.state === "suspended") {
                audioContext
                    .resume()
                    .then(() => {
                        document.removeEventListener("touchend", resumeAudioContext);
                    })
                    .catch((err) => {
                        console.error("AudioContext resume failed:", err);
                    });
            }
        };

        document.addEventListener("touchend", resumeAudioContext, false);
    }

    return handlePlayRecording;
}
