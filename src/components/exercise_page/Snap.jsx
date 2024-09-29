import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import he from "he";
import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { ArrowRightCircle, CheckCircleFill, XCircle, XCircleFill } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";

const filterAndShuffleQuiz = (quiz) => {
    // Remove duplicate questions
    const uniqueQuiz = _.uniqWith(quiz, _.isEqual);

    // Shuffle the quiz questions
    const shuffledQuiz = ShuffleArray(uniqueQuiz);

    // Shuffle the options (data) within each quiz question
    return shuffledQuiz.map((quizItem) => {
        return {
            ...quizItem,
            data: ShuffleArray(quizItem.data), // Shuffle the answer options within each question
        };
    });
};

const Snap = ({ quiz, onAnswer, onQuit, timer, setTimeIsUp }) => {
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [currentQuiz, setCurrentQuiz] = useState({});
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [isDropped, setIsDropped] = useState(false);
    const [result, setResult] = useState(null);
    const [droppedOn, setDroppedOn] = useState(null); // Track where the item is dropped
    const [isHorizontal, setIsHorizontal] = useState(true);

    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const { t } = useTranslation();

    useEffect(() => {
        if (timer > 0) {
            startTimer();
        }
    }, [timer, startTimer]);

    const loadQuiz = useCallback((quizData) => {
        const shuffledOptions = ShuffleArray([...quizData.data]); // Shuffle the options for this specific question
        setCurrentQuiz({ ...quizData, data: shuffledOptions }); // Set the current quiz with shuffled options
        setIsDropped(false);
        setResult(null);
        setDroppedOn(null);
    }, []);

    useEffect(() => {
        if (quiz && quiz.length > 0) {
            const uniqueShuffledQuiz = filterAndShuffleQuiz(quiz); // Filter and shuffle the quiz
            setShuffledQuiz(uniqueShuffledQuiz); // Set the shuffled quiz
            setCurrentQuizIndex(0); // Reset the quiz index to the first one
            loadQuiz(uniqueShuffledQuiz[0]); // Load the first question
        }
    }, [quiz, loadQuiz]);

    // Detect screen size to toggle between horizontal and vertical layout
    useEffect(() => {
        const handleResize = () => {
            setIsHorizontal(window.innerWidth >= 992); // Horizontal for large screens (992px and above)
        };

        window.addEventListener("resize", handleResize);
        handleResize(); // Run on mount to set initial value

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleDragEnd = (event) => {
        const { over } = event;
        if (!over) return;

        const feedbackValue = over.id.toLowerCase(); // The ID is either "yes" or "no", convert to lowercase
        const correctAnswer = currentQuiz?.feedbacks?.find((f) => f.correctAns)?.correctAns.toLowerCase(); // Normalize correctAns to lowercase

        // Check if the drop zone ("Yes" or "No") matches the correct answer
        const isCorrect = feedbackValue === correctAnswer;

        setResult(isCorrect ? "success" : "danger"); // Show success for correct, danger for incorrect
        setIsDropped(true);
        setDroppedOn(over.id); // Set the ID of the area where the item was dropped
        onAnswer(isCorrect ? 1 : 0, "single");
    };

    const handleNextQuiz = () => {
        if (currentQuizIndex < shuffledQuiz.length - 1) {
            const nextQuizIndex = currentQuizIndex + 1;
            setCurrentQuizIndex(nextQuizIndex);
            loadQuiz(shuffledQuiz[nextQuizIndex]);
        } else {
            onQuit();
            clearTimer();
        }
    };

    const handleQuit = () => {
        onQuit();
        clearTimer();
    };

    // Draggable item component
    const DraggableItem = ({ isDropped }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
            id: "draggable-item",
        });

        const adjustedTransform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

        const style = {
            transform: adjustedTransform,
            transition,
            touchAction: "none",
            cursor: isDropped ? "not-allowed" : isDragging ? "grabbing" : "grab",
            WebkitUserDrag: "none",
            WebkitTouchCallout: "none",
            opacity: 1, // Always keep the item visible
            userSelect: "none",
        };

        return (
            <Button
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                variant="primary"
                className={`w-100 fw-bold${isDropped ? " z-3" : " z-2"}`}
                disabled={isDropped}>
                {t("exercise_page.dragThisItem")}
            </Button>
        );
    };

    // Droppable area component
    const DroppableArea = ({ feedback, isDropped, result, droppedOn }) => {
        const { isOver, setNodeRef } = useDroppable({
            id: feedback?.value || "droppable-area",
        });

        const showColor = droppedOn === feedback?.value;

        const bgColor = showColor ? (result === "success" ? "bg-success" : "bg-danger") : isOver ? "bg-tertiary" : "";
        const buttonVariant = result === "success" ? "text-bg-success" : "text-bg-danger";
        const buttonText =
            result === "success" ? (
                <>
                    {t("exercise_page.snapCorrect")}
                    <CheckCircleFill className="ms-2" />
                </>
            ) : (
                <>
                    {t("exercise_page.snapIncorrect")}
                    <XCircleFill className="ms-2" />
                </>
            );

        return (
            <Card className="w-100">
                <Card.Body
                    ref={setNodeRef}
                    className={`text-center rounded-1 fw-bold ${bgColor} ${
                        isDropped && droppedOn === feedback?.value ? `pe-none ${buttonVariant} rounded-1` : ""
                    }`}>
                    {isDropped && droppedOn === feedback?.value ? (
                        <div>{buttonText}</div>
                    ) : (
                        <span>{feedback?.value}</span> // Show Yes/No only if item hasn't been dropped
                    )}
                </Card.Body>
            </Card>
        );
    };

    return (
        <>
            <Card.Header className="fw-semibold">
                <div className="d-flex">
                    <div className="me-auto">
                        {t("exercise_page.questionNo")} #{currentQuizIndex + 1}
                    </div>
                    {timer > 0 && (
                        <div className="ms-auto">
                            {t("exercise_page.timer")} {formatTime()}
                        </div>
                    )}
                </div>
            </Card.Header>
            <Card.Body>
                {/* Present Word and Phonetic Transcription */}
                <Row className="text-center mb-4">
                    <Col xs={12}>
                        <p className="h3">{he.decode(currentQuiz?.data?.[0]?.value || "")}</p>
                    </Col>
                    <Col xs={12}>
                        <p className="h3">{he.decode(currentQuiz?.data?.[1]?.value || "")}</p>
                    </Col>
                </Row>

                <DndContext onDragEnd={handleDragEnd}>
                    <Row
                        className={`d-flex ${
                            isHorizontal ? "flex-row" : "flex-column"
                        } justify-content-center align-items-center g-2`}>
                        {/* Yes drop zone */}
                        <Col lg={5} xs={12} className="d-flex justify-content-center">
                            <DroppableArea
                                feedback={currentQuiz?.feedbacks?.find((f) => f.value === "Yes")}
                                isDropped={isDropped}
                                result={result}
                                droppedOn={droppedOn} // Track where the item is dropped
                            />
                        </Col>

                        {/* Draggable item */}
                        <Col lg={2} xs={12} className="d-flex justify-content-center">
                            {!isDropped && <DraggableItem isDropped={isDropped} />}
                        </Col>

                        {/* No drop zone */}
                        <Col lg={5} xs={12} className="d-flex justify-content-center">
                            <DroppableArea
                                feedback={currentQuiz?.feedbacks?.find((f) => f.value === "No")}
                                isDropped={isDropped}
                                result={result}
                                droppedOn={droppedOn} // Track where the item is dropped
                            />
                        </Col>
                    </Row>
                </DndContext>

                <div className="d-flex justify-content-end mt-3">
                    <Button variant="secondary" onClick={handleNextQuiz}>
                        <ArrowRightCircle /> {t("exercise_page.buttons.nextBtn")}
                    </Button>
                    <Button variant="danger" className="ms-2" onClick={handleQuit}>
                        <XCircle /> {t("exercise_page.buttons.quitBtn")}
                    </Button>
                </div>
            </Card.Body>
        </>
    );
};

export default Snap;
