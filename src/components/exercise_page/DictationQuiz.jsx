import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { ArrowRightCircle, Check2Circle, VolumeUp, VolumeUpFill, XCircle } from "react-bootstrap-icons";
import useCountdownTimer from "../../utils/useCountdownTimer";
import { useTranslation } from "react-i18next";

const DictationQuiz = ({ quiz, timer, onAnswer, onQuit, setTimeIsUp }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [showValidation, setShowValidation] = useState(false);
    const [validationVariant, setValidationVariant] = useState("danger");
    const [validationMessage, setValidationMessage] = useState("");
    const [isTextboxDisabled, setIsTextboxDisabled] = useState(false);
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [isSubmitButtonEnabled, setIsSubmitButtonEnabled] = useState(false);
    const [hasAnswered, setHasAnswered] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const audioRef = useRef(null);

    const { t } = useTranslation();

    const filterAndShuffleQuiz = (quiz) => {
        const uniqueQuiz = _.uniqWith(quiz, _.isEqual);
        return _.shuffle(uniqueQuiz);
    };

    useEffect(() => {
        if (quiz?.length > 0) {
            setShuffledQuiz(filterAndShuffleQuiz([...quiz]));
        }

        return () => {
            // Cleanup: Stop audio when component unmounts
            stopAudio();
        };
    }, [quiz]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0; // Reset the audio to the start
            audioRef.current.removeAttribute("src"); // Remove the audio source attribute
            audioRef.current.load(); // Reload the audio element to reset the state
            setIsPlaying(false); // Reset the playing state
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!shuffledQuiz[currentQuestionIndex]) return;

        const textboxWord = shuffledQuiz[currentQuestionIndex].words.find((word) => word.textbox);
        if (!textboxWord) {
            console.error("No textbox found in the current question.");
            return;
        }

        const correctAnswer = textboxWord.textbox.toLowerCase();
        const isCorrect = answer.trim().toLowerCase() === correctAnswer;

        setIsTextboxDisabled(true);
        setIsSubmitButtonEnabled(true);
        setHasAnswered(true);
        setShowValidation(true);
        setValidationVariant(isCorrect ? "success" : "danger");
        setValidationMessage(
            isCorrect ? (
                ""
            ) : (
                <>
                    {t("exercise_page.result.correctAnswer")} <span className="fw-bold fst-italic">{correctAnswer}</span>
                </>
            )
        );

        onAnswer(isCorrect, "single");
    };

    const nextQuestion = () => {
        if ((!hasAnswered && answer.trim() === "") || !hasAnswered) {
            onAnswer(false, "single");
        }
        stopAudio();

        if (currentQuestionIndex < shuffledQuiz.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setAnswer("");
            setIsTextboxDisabled(false);
            setShowValidation(false);
            setIsSubmitButtonEnabled(false);
            setHasAnswered(false); // Reset for the next question
        } else {
            onQuit(); // Notify parent that the quiz is finished
            stopAudio();
            clearTimer();
        }
    };

    const handleNext = () => {
        nextQuestion(); // Move to the next question
    };

    const handleQuit = () => {
        onQuit();
        stopAudio();
        clearTimer();
    };

    const handleAudioPlay = () => {
        if (!shuffledQuiz[currentQuestionIndex]) return; // Safeguard against undefined access

        if (isPlaying) {
            // Stop the current audio if it's playing
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
            return;
        }

        const audio = new Audio();
        const audioSrc = `${import.meta.env.BASE_URL}media/exercise/mp3/${
            shuffledQuiz[currentQuestionIndex].audio.src
        }.mp3`;

        audioRef.current = audio;

        audio.src = audioSrc;
        setIsLoading(true);

        audio.oncanplaythrough = () => {
            setIsLoading(false);
            setIsPlaying(true);
            audio.play();
            startTimer();
        };

        audio.onended = () => {
            setIsPlaying(false);
        };

        audio.onerror = () => {
            setIsLoading(false);
            console.error("Audio error occurred. Unable to play the audio.");
            alert("Unable to play audio due to a network issue. Please check your connection and reload the page.");
        };

        audio.onpause = () => {
            setIsPlaying(false);
        };

        audioRef.current.load(); // Load the new audio source
    };

    const renderWords = () => {
        const currentWords = shuffledQuiz[currentQuestionIndex]?.words || [];

        // Check if the current word has both `value` and `textbox`
        const hasValueAndTextbox = currentWords.some((w) => w.value) && currentWords.some((w) => w.textbox);

        return currentWords.map((word, index) => {
            if (word.value) {
                return <span key={index}>{word.value}</span>;
            }

            if (word.textbox) {
                return (
                    <Form.Control
                        key={index}
                        type="text"
                        value={answer}
                        onChange={(e) => {
                            setAnswer(e.target.value);
                            startTimer();
                        }}
                        isInvalid={validationVariant === "danger" && showValidation}
                        isValid={validationVariant === "success" && showValidation}
                        autoComplete="off"
                        spellCheck="false"
                        disabled={isTextboxDisabled}
                        className={`px-0 text-center${hasValueAndTextbox ? " mx-2" : " w-50 mx-auto"}`}
                        style={hasValueAndTextbox ? { width: "40%", display: "inline-block" } : {}}
                    />
                );
            }

            return null;
        });
    };

    return (
        <>
            <Card.Header className="fw-semibold">
                <div className="d-flex">
                    <div className="me-auto">{t("exercise_page.questionNo")} #{currentQuestionIndex + 1}</div>
                    {timer > 0 && <div className="ms-auto">{t("exercise_page.timer")} {formatTime()}</div>}
                </div>
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col xs={12} className="d-flex justify-content-center">
                        <Button variant="primary" onClick={handleAudioPlay} className="mb-3" disabled={isLoading}>
                            {isLoading ? (
                                <Spinner animation="border" size="sm" />
                            ) : isPlaying ? (
                                <VolumeUpFill />
                            ) : (
                                <VolumeUp />
                            )}
                        </Button>
                    </Col>
                    <Col xs={12}>
                        <Form onSubmit={handleSubmit} className="text-center">
                            <Form.Group controlId="formAnswer">
                                <div>{renderWords()}</div>
                            </Form.Group>
                        </Form>
                    </Col>
                </Row>
                {showValidation && validationVariant === "danger" && (
                    <Alert className="mt-4" variant="info">
                        {validationMessage}
                    </Alert>
                )}
                <div className="d-flex justify-content-end mt-3">
                    <Button
                        variant="success"
                        type="submit"
                        className="mt-3"
                        disabled={isSubmitButtonEnabled}
                        onClick={handleSubmit}>
                        <Check2Circle /> {t("exercise_page.buttons.checkBtn")}
                    </Button>
                    {currentQuestionIndex < quiz.length - 1 && (
                        <Button variant="secondary" className="mt-3 ms-2" onClick={handleNext}>
                            <ArrowRightCircle /> {t("exercise_page.buttons.nextBtn")}
                        </Button>
                    )}
                    <Button variant="danger" className="mt-3 ms-2" onClick={handleQuit}>
                        <XCircle /> {t("exercise_page.buttons.quitBtn")}
                    </Button>
                </div>
            </Card.Body>
        </>
    );
};

export default DictationQuiz;
