import he from "he";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Modal, Ratio, Row } from "react-bootstrap";
import { ArrowLeftCircle, RecordCircleFill } from "react-bootstrap-icons";
import { Trans, useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { checkRecordingExists } from "../../utils/databaseOperations";
import { isElectron } from "../../utils/isElectron";
import LoadingOverlay from "../general/LoadingOverlay";
import ToastNotification from "../general/ToastNotification";
import ReviewCard from "./ReviewCard";
import SoundPracticeCard from "./SoundPracticeCard";
import { usePlaybackFunction } from "./usePlaybackFunction";
import { useRecordingFunction } from "./useRecordingFunction";
import { useSoundVideoMapping } from "./useSoundVideoMapping";

const PracticeSound = ({ sound, accent, onBack, index, soundsData }) => {
    const { t } = useTranslation();

    const accentKey = accent === "american" ? "a" : "b";
    const accentData = sound[accentKey][0];

    const findPhonemeDetails = useCallback(
        (phoneme) => {
            let index = soundsData.consonants.findIndex((p) => p.phoneme === phoneme);
            if (index !== -1) {
                return { index, type: "consonant" };
            }

            index = soundsData.vowels_n_diphthongs.findIndex((p) => p.phoneme === phoneme);
            if (index !== -1) {
                return { index, type: "vowel" };
            }

            return { index: -1, type: null }; // Not found
        },
        [soundsData.consonants, soundsData.vowels_n_diphthongs]
    );

    const { index: phonemeIndex, type } = findPhonemeDetails(sound.phoneme);

    const { videoUrls, videoUrl, videoLoading } = useSoundVideoMapping(type, accent, soundsData, phonemeIndex);

    const imgPhonemeThumbSrc =
        accent === "american"
            ? `${import.meta.env.BASE_URL}images/ispeaker/sound_images/sounds_american.jpg`
            : `${import.meta.env.BASE_URL}images/ispeaker/sound_images/sounds_british.jpg`;

    const [review, setReview] = useState(null);

    const handleReviewClick = (newReview) => {
        const { type } = findPhonemeDetails(sound.phoneme);
        const reviewKey = `${type}${index + 1}`; // Adding 1 to make it 1-indexed, matching "consonant1", "vowel1", etc.

        // Fetch current ispeaker data or initialize
        const ispeakerData = JSON.parse(localStorage.getItem("ispeaker") || "{}");
        // Ensure soundReview object exists for both accents
        ispeakerData.soundReview = ispeakerData.soundReview || {};
        ispeakerData.soundReview[accent] = ispeakerData.soundReview[accent] || {};
        // Save the new review under the correct accent and review key
        ispeakerData.soundReview[accent][reviewKey] = newReview;

        localStorage.setItem("ispeaker", JSON.stringify(ispeakerData));
        setReview(newReview);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        // Fetch reviews from localStorage
        const reviews = JSON.parse(localStorage.getItem("ispeaker") || "{}").soundReview || {};
        const { type } = findPhonemeDetails(sound.phoneme);
        const reviewKey = `${type}${index + 1}`;

        // Try to load the review for the current accent and phoneme
        const soundReview = reviews[accent] ? reviews[accent][reviewKey] : null;
        if (soundReview) {
            setReview(soundReview);
        }
    }, [sound.phoneme, findPhonemeDetails, accent, index]);

    const emojiStyle = (reviewType) => {
        const styles = {
            good: "text-success",
            neutral: "text-warning",
            bad: "text-danger",
        };
        return review === reviewType ? styles[reviewType] : "";
    };

    // Video modals

    const [show, setShow] = useState(false);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
    const [selectedVideoModalIndex, setSelectedVideoModalIndex] = useState("");

    const handleShow = (videoIndex) => {
        setSelectedVideoModalIndex(videoIndex);
        setSelectedVideoUrl(videoUrls[videoIndex]);
        setShow(true);
        setIframeLoadingStates((prevStates) => ({
            ...prevStates,
            modalIframe: true, // Reset the modal iframe loading state to true when modal is opened
        }));
    };

    const handleClose = () => setShow(false);

    // iframe loading
    const [iframeLoadingStates, setIframeLoadingStates] = useState({
        mainIframe: true,
        modalIframe: true,
    });

    const handleIframeLoad = (iframeKey) => {
        setIframeLoadingStates((prevStates) => ({
            ...prevStates,
            [iframeKey]: false,
        }));
    };

    // Recording & playback

    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecordingPlaying, setIsRecordingPlaying] = useState(false);
    const [activeRecordingCard, setActiveRecordingCard] = useState(null);
    const [recordingAvailability, setRecordingAvailability] = useState({});
    const [playingRecordings, setPlayingRecordings] = useState({});
    const [activePlaybackCard, setActivePlaybackCard] = useState(null);

    const [currentAudioSource, setCurrentAudioSource] = useState(null); // For AudioContext source node
    const [currentAudioElement, setCurrentAudioElement] = useState(null); // For Audio element (fallback)

    // Notification state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const { getRecordingKey, isRecordingPlayingActive, isRecordingAvailable, handleRecording } = useRecordingFunction(
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
    );

    useEffect(() => {
        // Assume checkRecordingExists is a function that checks if a recording exists and returns a promise that resolves to a boolean
        const checks = [];
        for (let i = 1; i <= 4; i++) {
            const key = getRecordingKey(i);
            checks.push(checkRecordingExists(key).then((exists) => ({ key, exists })));
        }

        Promise.all(checks).then((results) => {
            const newAvailability = results.reduce((acc, { key, exists }) => {
                acc[key] = exists;
                return acc;
            }, {});
            setRecordingAvailability(newAvailability);
        });
    }, [getRecordingKey]);

    const handlePlayRecording = usePlaybackFunction(
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
    );

    useEffect(() => {
        // Cleanup function to stop recording and playback
        return () => {
            // Stop the recording if it's active
            if (isRecording && mediaRecorder) {
                mediaRecorder.stop();
                setIsRecording(false);
            }

            // Stop AudioContext playback
            if (currentAudioSource) {
                try {
                    currentAudioSource.stop();
                } catch (error) {
                    console.error("Error stopping AudioContext source during cleanup:", error);
                }
                setCurrentAudioSource(null);
            }

            // Stop Audio element playback
            if (currentAudioElement) {
                currentAudioElement.pause();
                currentAudioElement.currentTime = 0;
                setCurrentAudioElement(null);
            }
        };
    }, [isRecording, mediaRecorder, currentAudioSource, currentAudioElement]);

    if (!videoUrl) {
        return <LoadingOverlay />;
    }

    return (
        <>
            <Row className="mt-4">
                <Col lg={3} className="mb-4">
                    <h3>
                        {t("sound_page.soundTop")} {he.decode(sound.phoneme)}
                    </h3>
                    <p>
                        {t("accent.accentSettings")}:{" "}
                        {accent == "american" ? t("accent.accentAmerican") : t("accent.accentBritish")}
                    </p>
                    {accentData && (
                        <>
                            <p className="fw-semibold">{t("sound_page.exampleWords")}</p>
                            {["initial", "medial", "final"].map((position) => (
                                <p
                                    key={position}
                                    dangerouslySetInnerHTML={{ __html: he.decode(accentData[position]) }}></p>
                            ))}
                        </>
                    )}
                    <Button onClick={onBack}>
                        <ArrowLeftCircle /> {t("sound_page.backBtn")}
                    </Button>
                </Col>
                <Col lg={9}>
                    <Card className="mb-4 shadow-sm">
                        <Card.Header className="fw-semibold">{t("sound_page.watchCard")}</Card.Header>
                        <Card.Body>
                            <Ratio aspectRatio="16x9">
                                <div>
                                    {isElectron() &&
                                    videoUrl?.isLocal &&
                                    videoUrl.value.includes("http://localhost") ? (
                                        <video controls className="w-100 h-100">
                                            <source src={videoUrl.value} type="video/mp4" />
                                            Your browser does not support the video tag.
                                        </video>
                                    ) : (
                                        <>
                                            {iframeLoadingStates.mainIframe && (
                                                <Skeleton className="placeholder" height="100%" width="100%" />
                                            )}
                                            <iframe
                                                src={videoUrl?.value}
                                                title="Phoneme Video"
                                                loading="lazy"
                                                allowFullScreen
                                                onLoad={() => {
                                                    handleIframeLoad("mainIframe");
                                                }}
                                                style={
                                                    iframeLoadingStates.mainIframe
                                                        ? { visibility: "hidden" }
                                                        : { visibility: "visible" }
                                                }
                                                className="w-100 h-100"></iframe>
                                        </>
                                    )}
                                </div>
                            </Ratio>
                            {isElectron() && !videoUrl?.value.includes("http://localhost") ? (
                                <Alert variant="secondary" className="mt-4">
                                    {t("alert.alertOnlineVideo")}
                                </Alert>
                            ) : (
                                ""
                            )}
                        </Card.Body>
                    </Card>
                    <Card className="mb-4 shadow-sm">
                        <Card.Header className="fw-semibold">{t("sound_page.practiceCard")}</Card.Header>
                        <Card.Body>
                            <Card.Text>
                                <Trans
                                    i18nKey="sound_page.recordInstructions"
                                    components={[<RecordCircleFill key="0" aria-label="record icon" />]}
                                />
                            </Card.Text>
                            <SoundPracticeCard
                                sound={sound}
                                handleShow={handleShow}
                                imgPhonemeThumbSrc={imgPhonemeThumbSrc}
                                activeRecordingCard={activeRecordingCard}
                                isRecordingPlaying={isRecordingPlaying}
                                activePlaybackCard={activePlaybackCard}
                                accentData={accentData}
                                isRecordingPlayingActive={isRecordingPlayingActive}
                                isRecordingAvailable={isRecordingAvailable}
                                handleRecording={handleRecording}
                                handlePlayRecording={handlePlayRecording}
                            />
                        </Card.Body>
                    </Card>
                    <ReviewCard sound={sound} handleReviewClick={handleReviewClick} emojiStyle={emojiStyle} />
                </Col>
            </Row>
            <Modal show={show} onHide={handleClose} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {t("sound_page.clipModalTitle")} #{selectedVideoModalIndex}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Ratio aspectRatio="16x9">
                        <div>
                            {isElectron() && selectedVideoUrl.includes("localhost:8998") ? (
                                <video controls className="w-100 h-100">
                                    <source src={selectedVideoUrl} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <>
                                    {iframeLoadingStates.modalIframe && (
                                        <Skeleton className="placeholder" height="100%" width="100%" />
                                    )}
                                    <iframe
                                        src={selectedVideoUrl}
                                        title="Phoneme Video"
                                        allowFullScreen
                                        onLoad={() => {
                                            handleIframeLoad("modalIframe");
                                        }}
                                        style={
                                            iframeLoadingStates.modalIframe
                                                ? { visibility: "hidden" }
                                                : { visibility: "visible" }
                                        }
                                        className="w-100 h-100"></iframe>
                                </>
                            )}
                        </div>
                    </Ratio>
                    {isElectron() && !selectedVideoUrl.startsWith("http://localhost") ? (
                        <Alert variant="secondary" className="mt-4">
                            {t("alert.alertOnlineVideo")}
                        </Alert>
                    ) : (
                        ""
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        {t("sound_page.closeBtn")}
                    </Button>
                </Modal.Footer>
            </Modal>

            <ToastNotification
                show={showToast}
                onClose={() => setShowToast(false)}
                message={toastMessage}
                variant="warning"
            />
        </>
    );
};

export default PracticeSound;
