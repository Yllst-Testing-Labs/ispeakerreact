import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    horizontalListSortingStrategy,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import he from "he";
import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { ArrowRightCircle, Check2Circle, XCircle } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";
import SortableWord from "./SortableWord";

const SortingExercise = ({ quiz, onAnswer, onQuit, useHorizontalStrategy = false, timer, setTimeIsUp }) => {
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [itemsLeft, setItemsLeft] = useState([]);
    const [itemsRight, setItemsRight] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [buttonsDisabled, setButtonsDisabled] = useState(false);
    const [currentTableHeading, setCurrentTableHeading] = useState([]);
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const { t } = useTranslation();

    useEffect(() => {
        if (timer > 0) {
            startTimer();
        }
    }, [timer, startTimer]);

    const sensors = useSensors(useSensor(PointerSensor));

    const filterAndShuffleQuiz = useCallback((quiz) => {
        const uniqueQuiz = _.uniqWith(quiz, _.isEqual);
        return ShuffleArray(uniqueQuiz);
    }, []);

    const generateUniqueItems = (items) => {
        return items.map((item, index) => ({
            ...item,
            id: `${item.value}-${index}-${Math.random().toString(36).substring(2, 11)}`,
        }));
    };

    const loadQuiz = useCallback((quizData) => {
        const shuffledOptions = ShuffleArray([...quizData.rowOptions]);
        const uniqueItems = generateUniqueItems(shuffledOptions);

        const halfwayPoint = Math.ceil(uniqueItems.length / 2);
        const itemsLeft = uniqueItems.slice(0, halfwayPoint);
        const itemsRight = uniqueItems.slice(halfwayPoint);

        setItemsLeft(itemsLeft);
        setItemsRight(itemsRight);
        setCurrentTableHeading(quizData.tableHeading);
        setButtonsDisabled(false);
        setHasSubmitted(false); // Reset submission status for each quiz
    }, []);

    useEffect(() => {
        if (quiz && quiz.length > 0) {
            const uniqueShuffledQuiz = filterAndShuffleQuiz(quiz); // Ensure uniqueness and shuffle
            setShuffledQuiz(uniqueShuffledQuiz);
            setCurrentQuizIndex(0); // Reset currentQuizIndex to 0
        }
    }, [quiz, filterAndShuffleQuiz]);

    useEffect(() => {
        if (shuffledQuiz.length > 0 && currentQuizIndex < shuffledQuiz.length) {
            loadQuiz(shuffledQuiz[currentQuizIndex]);
        }
    }, [shuffledQuiz, currentQuizIndex, loadQuiz]);

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        if (active.id !== over.id) {
            // Find the active item
            const activeItem =
                itemsLeft.find((item) => item.id === active.id) || itemsRight.find((item) => item.id === active.id);

            if (!activeItem) return;

            // Determine if the item is moving between columns
            if (itemsLeft.some((item) => item.id === active.id)) {
                // Moving from left to right
                if (itemsRight.some((item) => item.id === over.id) || itemsRight.length === 0) {
                    setItemsLeft((items) => items.filter((item) => item.id !== active.id));
                    setItemsRight((items) => [...itemsRight, activeItem]);
                } else {
                    const oldIndex = itemsLeft.findIndex((item) => item.id === active.id);
                    const newIndex = itemsLeft.findIndex((item) => item.id === over.id);
                    setItemsLeft((items) => arrayMove(items, oldIndex, newIndex));
                }
            } else if (itemsRight.some((item) => item.id === active.id)) {
                // Moving from right to left
                if (itemsLeft.some((item) => item.id === over.id) || itemsLeft.length === 0) {
                    setItemsRight((items) => items.filter((item) => item.id !== active.id));
                    setItemsLeft((items) => [...itemsLeft, activeItem]);
                } else {
                    const oldIndex = itemsRight.findIndex((item) => item.id === active.id);
                    const newIndex = itemsRight.findIndex((item) => item.id === over.id);
                    setItemsRight((items) => arrayMove(items, oldIndex, newIndex));
                }
            }
        }

        setActiveId(null);
    };

    const handleSubmit = () => {
        const allItems = [...itemsLeft, ...itemsRight];
        let correctCount = 0;

        allItems.forEach((item) => {
            const expectedColumn = item.columnPos;
            const actualColumn = itemsLeft.includes(item) ? 1 : 2;
            if (expectedColumn === actualColumn) {
                correctCount++;
            }
        });

        setButtonsDisabled(true);
        setHasSubmitted(true); // Mark the answers as submitted
        onAnswer(correctCount, "multiple", allItems.length);
    };

    const handleNextQuiz = () => {
        if (currentQuizIndex < shuffledQuiz.length - 1) {
            setCurrentQuizIndex((prevIndex) => prevIndex + 1);
        } else {
            onQuit();
            clearTimer();
        }
    };

    const handleQuit = () => {
        onQuit();
        clearTimer();
    };

    const sortableStrategy = useHorizontalStrategy ? horizontalListSortingStrategy : verticalListSortingStrategy;

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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}>
                    <Row className="d-flex justify-content-center">
                        <Col xs={6} md={6}>
                            <Card>
                                <Card.Header className="text-center fw-semibold">
                                    {currentTableHeading.length > 0 && (
                                        <span
                                            dangerouslySetInnerHTML={{ __html: he.decode(currentTableHeading[0].text) }}
                                        />
                                    )}
                                </Card.Header>
                                <Card.Body>
                                    <SortableContext items={itemsLeft} strategy={sortableStrategy}>
                                        {itemsLeft.length > 0 ? (
                                            itemsLeft.map((item) => (
                                                <SortableWord
                                                    key={item.id}
                                                    item={item}
                                                    isCorrect={hasSubmitted ? item.columnPos === 1 : null}
                                                    disabled={buttonsDisabled}
                                                />
                                            ))
                                        ) : (
                                            <>
                                                <div className="text-center w-100 p-4">
                                                    <div className="p-4 border rounded text-secondary">
                                                        {t("exercise_page.dropLayer")}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </SortableContext>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xs={6} md={6}>
                            <Card>
                                <Card.Header className="text-center fw-semibold">
                                    {currentTableHeading.length > 0 && (
                                        <span
                                            dangerouslySetInnerHTML={{ __html: he.decode(currentTableHeading[1].text) }}
                                        />
                                    )}
                                </Card.Header>
                                <Card.Body>
                                    <SortableContext items={itemsRight} strategy={sortableStrategy}>
                                        {itemsRight.length > 0 ? (
                                            itemsRight.map((item) => (
                                                <SortableWord
                                                    key={item.id}
                                                    item={item}
                                                    isCorrect={hasSubmitted ? item.columnPos === 2 : null}
                                                    disabled={buttonsDisabled}
                                                />
                                            ))
                                        ) : (
                                            <>
                                                <div className="text-center w-100 p-4">
                                                    <div className="p-4 border rounded text-secondary">
                                                        {t("exercise_page.dropLayer")}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </SortableContext>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                    <DragOverlay>
                        {activeId ? (
                            <SortableWord
                                item={itemsLeft.concat(itemsRight).find((item) => item.id === activeId)}
                                isOverlay
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
                <div className="d-flex justify-content-end mt-3">
                    <Button variant="success" onClick={handleSubmit} disabled={buttonsDisabled}>
                        <Check2Circle /> {t("exercise_page.buttons.checkBtn")}
                    </Button>
                    {currentQuizIndex < shuffledQuiz.length - 1 && (
                        <Button variant="secondary" className="ms-2" onClick={handleNextQuiz}>
                            <ArrowRightCircle /> {t("exercise_page.buttons.nextBtn")}
                        </Button>
                    )}
                    <Button variant="danger" className="ms-2" onClick={handleQuit}>
                        <XCircle /> {t("exercise_page.buttons.quitBtn")}
                    </Button>
                </div>
            </Card.Body>
        </>
    );
};

export default SortingExercise;
