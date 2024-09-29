import {
    DndContext,
    DragOverlay,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import he from "he";
import _ from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Row, Spinner, Stack } from "react-bootstrap";
import { ArrowRightCircle, Check2Circle, VolumeUp, VolumeUpFill, XCircle } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";
import SortableWord from "./SortableWord";

const Reordering = ({ quiz, onAnswer, onQuit, timer, setTimeIsUp }) => {
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [shuffledItems, setShuffledItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Loading state for audio
    const [buttonsDisabled, setButtonsDisabled] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [correctAnswer, setCorrectAnswer] = useState("");
    const [currentSplitType, setCurrentSplitType] = useState("");
    const [currentAudioSrc, setCurrentAudioSrc] = useState("");
    const [shuffledQuizArray, setShuffledQuizArray] = useState([]);

    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const { t } = useTranslation();

    const filterAndShuffleQuiz = (quiz) => {
        const uniqueQuiz = _.uniqWith(quiz, _.isEqual);

        // Shuffle the unique items
        return ShuffleArray(uniqueQuiz);
    };

    // Use a ref to manage the audio element
    const audioRef = useRef(null);

    const loadQuiz = useCallback((quizData) => {
        const splitType = quizData.split;
        setCurrentSplitType(splitType);

        const pairedData = quizData.data.map((item, index) => ({
            word: item.value,
            audio: quizData.audio.src,
            answer: quizData.answer[index],
        }));

        const shuffledPairs = ShuffleArray(pairedData);
        const shuffledWords = shuffledPairs.map((pair) => pair.word);
        const correctAnswer = shuffledPairs.map((pair) => pair.answer).join(splitType === "sentence" ? " " : "");

        let itemsToShuffle;
        if (splitType === "sentence") {
            itemsToShuffle = shuffledWords[0].split(" "); // Split into words for sentences
        } else if (splitType === "word") {
            itemsToShuffle = shuffledWords[0].split(""); // Split into letters for words
        } else {
            console.warn("Unexpected split type, defaulting to splitting by letters");
            itemsToShuffle = shuffledWords[0].split("");
        }

        const uniqueItems = generateUniqueItems(itemsToShuffle);
        const shuffledItemsArray = ShuffleArray(uniqueItems);
        setShuffledItems(shuffledItemsArray);
        setButtonsDisabled(false);

        setCurrentAudioSrc(`${import.meta.env.BASE_URL}media/exercise/mp3/${shuffledPairs[0].audio}.mp3`);
        setCorrectAnswer(correctAnswer);
    }, []);

    // Clean up the audio element
    const stopAudio = () => {
        if (audioRef.current) {
            // Stop the audio and remove event listeners
            audioRef.current.pause();
            audioRef.current.currentTime = 0; // Reset the audio to the beginning

            // Remove event listeners to prevent them from triggering after the source is cleared
            audioRef.current.oncanplaythrough = null;
            audioRef.current.onended = null;
            audioRef.current.onerror = null;

            setIsPlaying(false);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (quiz && quiz.length > 0) {
            // Filter out unique items and shuffle the quiz array
            const uniqueShuffledQuiz = filterAndShuffleQuiz(quiz);
            setShuffledQuizArray(uniqueShuffledQuiz);
            // Reset currentQuizIndex to 0
            setCurrentQuizIndex(0);
        }
    }, [quiz]);

    useEffect(() => {
        if (shuffledQuizArray.length > 0 && currentQuizIndex < shuffledQuizArray.length) {
            loadQuiz(shuffledQuizArray[currentQuizIndex]);
        }
    }, [shuffledQuizArray, currentQuizIndex, loadQuiz]);

    useEffect(() => {
        return () => {
            stopAudio();
        };
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            preventScrolling: true,
        })
    );

    const generateUniqueItems = (items) => {
        return items.map((item, index) => ({
            id: `${item}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            value: item,
        }));
    };

    const handleAudioPlay = () => {
        if (!audioRef.current) {
            // Initialize the audio element if not already set
            audioRef.current = new Audio();
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            setIsLoading(true); // Start loading

            // Set the audio source and load the audio
            audioRef.current.src = currentAudioSrc;
            audioRef.current.load();

            // Play the audio once it's ready
            audioRef.current.oncanplaythrough = () => {
                setIsLoading(false); // Stop loading spinner
                audioRef.current.play();
                setIsPlaying(true);
                startTimer();
            };

            // Handle the audio ended event
            audioRef.current.onended = () => {
                setIsPlaying(false);
            };

            // Handle errors during loading
            audioRef.current.onerror = () => {
                setIsLoading(false); // Stop loading spinner
                setIsPlaying(false); // Reset playing state
                console.error("Error playing audio.");
                alert("There was an error loading the audio file. Please check your connection or try again later.");
            };
        }
    };

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        startTimer();
    };

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);

        if (over && active.id !== over.id) {
            setShuffledItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSubmit = () => {
        const splitType = currentSplitType;

        // Join the shuffled items into a single string
        let joinedItems = shuffledItems.map((item) => item.value).join(splitType === "sentence" ? " " : "");

        // Normalize user answer
        let normalizedUserAnswer = joinedItems
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // Remove punctuation
            .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
            .trim()
            .toLowerCase();

        // Normalize correct answer
        let normalizedCorrectAnswer = correctAnswer
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") // Remove punctuation
            .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
            .trim()
            .toLowerCase();

        // Determine if the user's answer is correct
        const isCorrect = normalizedCorrectAnswer === normalizedUserAnswer;
        setButtonsDisabled(true);

        // Determine the final display text
        const finalDisplay = isCorrect && splitType === "sentence" ? correctAnswer : joinedItems;

        // Update the shuffledItems to display either the user input or the correct answer
        setShuffledItems([{ value: finalDisplay, id: "united", isCorrect }]);

        // Show the correct answer alert if the user's answer was incorrect
        if (!isCorrect) {
            setShowAlert(true);
        }

        onAnswer(isCorrect ? 1 : 0, "single");
    };

    const handleNextQuiz = () => {
        if (!buttonsDisabled) {
            onAnswer(0, "single");
        }

        stopAudio();

        if (currentQuizIndex < shuffledQuizArray.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
            setShowAlert(false);
            loadQuiz(shuffledQuizArray[currentQuizIndex + 1]);
        } else {
            onQuit();
            stopAudio();
            clearTimer();
        }
    };

    const handleQuit = () => {
        onQuit();
        stopAudio();
        clearTimer();
    };

    return (
        <>
            <Card.Header className="fw-semibold">
                <div className="d-flex">
                    <div className="me-auto">{t("exercise_page.questionNo")} #{currentQuizIndex + 1}</div>
                    {timer > 0 && <div className="ms-auto">{t("exercise_page.timer")} {formatTime()}</div>}
                </div>
            </Card.Header>
            <Card.Body>
                <Row className="d-flex justify-content-center g-3">
                    <Col xs={12} className="d-flex justify-content-center">
                        <Button variant="primary" onClick={handleAudioPlay} disabled={isLoading}>
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
                        <div className="d-flex justify-content-center flex-row flex-wrap gap-2">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}>
                                <SortableContext items={shuffledItems} strategy={horizontalListSortingStrategy}>
                                    {shuffledItems.map((item) => (
                                        <SortableWord
                                            key={item.id}
                                            word={{ text: he.encode(item.value), id: item.id }}
                                            disabled={buttonsDisabled}
                                            isCorrect={item.isCorrect ?? null}
                                        />
                                    ))}
                                </SortableContext>
                                <DragOverlay>
                                    {activeId ? (
                                        <SortableWord
                                            key={activeId}
                                            word={{
                                                text: he.encode(
                                                    shuffledItems.find((item) => item.id === activeId)?.value || ""
                                                ),
                                                id: activeId,
                                            }}
                                            isOverlay={true}
                                        />
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    </Col>
                </Row>
                {showAlert && (
                    <Alert variant="info" className="mt-2">
                        {t("exercise_page.result.correctAnswer")} <span className="fw-bold fst-italic">{correctAnswer}</span>
                    </Alert>
                )}
                <div className="d-flex justify-content-end mt-3">
                    <Stack direction="horizontal" gap={2}>
                        <Button variant="success" onClick={handleSubmit} disabled={buttonsDisabled}>
                            <Check2Circle /> {t("exercise_page.buttons.checkBtn")}
                        </Button>
                        {currentQuizIndex < quiz.length - 1 && (
                            <Button variant="secondary" onClick={handleNextQuiz}>
                                <ArrowRightCircle /> {t("exercise_page.buttons.nextBtn")}
                            </Button>
                        )}
                        <Button variant="danger" onClick={handleQuit}>
                            <XCircle /> {t("exercise_page.buttons.quitBtn")}
                        </Button>
                    </Stack>
                </div>
            </Card.Body>
        </>
    );
};

export default Reordering;
