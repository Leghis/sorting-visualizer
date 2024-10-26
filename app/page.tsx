// app/page.tsx
"use client";

import {useState, useEffect, useRef, useMemo} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {Button} from "@/components/ui/button";
import confetti from "canvas-confetti";
import {Line} from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Slider} from "@/components/ui/slider";
import {Card} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

// Interfaces
interface ArrayBar {
    value: number;
    isComparing: boolean;
    isSorted: boolean;
    isSwapping: boolean;
}

interface SortStats {
    comparisons: number;
    swaps: number;
    timeElapsed: number;
}
interface WindowWithWebkit extends Window {
    webkitAudioContext: typeof AudioContext;
}

interface SortHistory {
    id: number;
    algorithm: string;
    arraySize: number;
    comparisons: number;
    swaps: number;
    timeElapsed: number;
    timestamp: Date;
}

interface BenchmarkResult {
    algorithm: string;
    sizes: number[];
    times: number[];
    comparisons: number[];
    swaps: number[];
}

// Constants
const ARRAY_SIZE = 50;
const MIN_VALUE = 5;
const MAX_VALUE = 100;

// Chart.js Registration
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);


export default function Page() {
    // États
    const [array, setArray] = useState<ArrayBar[]>([]);
    const [sorting, setSorting] = useState(false);
    const [algorithm, setAlgorithm] = useState("bubble");
    const [speed, setSpeed] = useState(50);
    const [stats, setStats] = useState<SortStats>({comparisons: 0, swaps: 0, timeElapsed: 0});
    const [isPaused, setIsPaused] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [currentStep, setCurrentStep] = useState<string>("");
    const pauseRef = useRef(false);
    const [sortHistory, setSortHistory] = useState<SortHistory[]>([]);
    const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Ajoutez cette fonction au début du composant
    const updateStats = (newStats: Partial<SortStats>) => {
        setStats(prevStats => ({
            ...prevStats,
            ...newStats
        }));
    };

    // Audio Context
    const [audioContext] = useState(() => {
        if (typeof window !== "undefined") {
            return new (window.AudioContext || (window as WindowWithWebkit).webkitAudioContext)();
        }
        return null;
    });

    const playNote = (frequency: number) => {
        if (!soundEnabled || !audioContext) return;

        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            gainNode.gain.value = 0.1;

            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.error("Erreur lors de la lecture du son:", error);
        }
    };

    const averageStats = useMemo(() => {
        return sortHistory.reduce((acc, curr) => {
            acc[curr.algorithm] = acc[curr.algorithm] || { total: 0, count: 0 };
            acc[curr.algorithm].total += curr.timeElapsed;
            acc[curr.algorithm].count += 1;
            return acc;
        }, {} as Record<string, { total: number; count: number }>);
    }, [sortHistory]);

    // Génération du tableau
    const generateArray = () => {
        const newArray: ArrayBar[] = [];
        for (let i = 0; i < ARRAY_SIZE; i++) {
            newArray.push({
                value: Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE,
                isComparing: false,
                isSorted: false,
                isSwapping: false,
            });
        }
        setArray(newArray);
        setStats({comparisons: 0, swaps: 0, timeElapsed: 0});
    };

    useEffect(() => {
        generateArray();
    }, []);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (sorting && !isPaused && startTime) {
            intervalId = setInterval(() => {
                updateStats({ timeElapsed: Date.now() - startTime });
            }, 100);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [sorting, isPaused, startTime]);

    useEffect(() => {
        if (audioContext && audioContext.state === 'suspended' && soundEnabled) {
            audioContext.resume();
        }
    }, [soundEnabled, audioContext]);

    // Fonctions utilitaires
    const sleep = (ms: number) => new Promise((resolve) => {
        const checkPause = async () => {
            while (pauseRef.current) {
                await new Promise(r => setTimeout(r, 100));
            }
            resolve(true);
        };
        setTimeout(checkPause, ms);
    });

    const addToHistory = (stats: SortStats) => {
        const historyEntry: SortHistory = {
            id: Date.now(),
            algorithm,
            arraySize: array.length,
            comparisons: stats.comparisons,
            swaps: stats.swaps,
            timeElapsed: stats.timeElapsed,
            timestamp: new Date(),
        };
        setSortHistory(prev => [...prev, historyEntry]);
    };

    const exportData = (format: 'csv' | 'json') => {
        const data = sortHistory;
        if (format === 'csv') {
            const headers = 'Algorithm,Array Size,Comparisons,Swaps,Time Elapsed,Timestamp\n';
            const csv = data.map(entry =>
                `${entry.algorithm},${entry.arraySize},${entry.comparisons},${entry.swaps},${entry.timeElapsed},${entry.timestamp}`
            ).join('\n');

            const blob = new Blob([headers + csv], {type: 'text/csv'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sort-history-${new Date().toISOString()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sort-history-${new Date().toISOString()}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    };

    // Bubble Sort
    const bubbleSort = async (arr: ArrayBar[], currentStats: SortStats, isBenchmark: boolean) => {
        const startTime = Date.now();
        if (!isBenchmark) setSorting(true);
        const workingArray = [...arr];
        const n = workingArray.length;

        for (let i = 0; i < n - 1; i++) {
            if (!isBenchmark) setCurrentStep(`Passe ${i + 1}/${n - 1}`);
            for (let j = 0; j < n - i - 1; j++) {
                if (!isBenchmark) {
                    workingArray[j].isComparing = true;
                    workingArray[j + 1].isComparing = true;
                    setArray([...workingArray]);
                    await sleep(speed);
                }

                currentStats.comparisons++;
                if (!isBenchmark) {
                    updateStats({ comparisons: currentStats.comparisons });
                }
                if (workingArray[j].value > workingArray[j + 1].value) {
                    if (!isBenchmark) {
                        workingArray[j].isSwapping = true;
                        workingArray[j + 1].isSwapping = true;
                        setArray([...workingArray]);
                        await sleep(speed);
                    }

                    const temp = workingArray[j];
                    workingArray[j] = workingArray[j + 1];
                    workingArray[j + 1] = temp;
                    currentStats.swaps++;
                    if (!isBenchmark) {
                        updateStats({ swaps: currentStats.swaps });
                    }

                    if (!isBenchmark && soundEnabled) {
                        playNote(400 + workingArray[j].value * 2);
                    }
                }

                if (!isBenchmark) {
                    workingArray[j].isComparing = false;
                    workingArray[j + 1].isComparing = false;
                    workingArray[j].isSwapping = false;
                    workingArray[j + 1].isSwapping = false;
                    setArray([...workingArray]);
                }
            }
            if (!isBenchmark) workingArray[n - i - 1].isSorted = true;
        }

        if (!isBenchmark) {
            workingArray[0].isSorted = true;
            setArray([...workingArray]);
            setSorting(false);
            confetti();
        }

        currentStats.timeElapsed = Date.now() - startTime;
        if (!isBenchmark) addToHistory(currentStats);

        return workingArray;
    };

    // Quick Sort
    const quickSort = async (arr: ArrayBar[], currentStats: SortStats, isBenchmark: boolean) => {
        const startTime = Date.now();
        if (!isBenchmark) setSorting(true);
        const workingArray = [...arr];

        const partition = async (low: number, high: number) => {
            const pivot = workingArray[high].value;
            let i = low - 1;

            for (let j = low; j < high; j++) {
                if (!isBenchmark) {
                    workingArray[j].isComparing = true;
                    workingArray[high].isComparing = true;
                    setArray([...workingArray]);
                    await sleep(speed);
                }

                currentStats.comparisons++;
                if (!isBenchmark) {
                    updateStats({ comparisons: currentStats.comparisons });
                }
                if (workingArray[j].value < pivot) {
                    i++;
                    if (!isBenchmark) {
                        workingArray[i].isSwapping = true;
                        workingArray[j].isSwapping = true;
                        setArray([...workingArray]);
                        await sleep(speed);
                    }

                    const temp = workingArray[i];
                    workingArray[i] = workingArray[j];
                    workingArray[j] = temp;
                    currentStats.swaps++;
                    if (!isBenchmark) {
                        updateStats({ swaps: currentStats.swaps });
                    }

                    if (!isBenchmark && soundEnabled) {
                        playNote(400 + workingArray[j].value * 2);
                    }
                }

                if (!isBenchmark) {
                    workingArray[j].isComparing = false;
                    workingArray[high].isComparing = false;
                    if (workingArray[i]) workingArray[i].isSwapping = false;
                    workingArray[j].isSwapping = false;
                }
            }

            const temp = workingArray[i + 1];
            workingArray[i + 1] = workingArray[high];
            workingArray[high] = temp;
            currentStats.swaps++;
            if (!isBenchmark) {
                updateStats({ swaps: currentStats.swaps });
            }

            return i + 1;
        };

        const quickSortHelper = async (low: number, high: number) => {
            if (low < high) {
                if (!isBenchmark) setCurrentStep(`Partition: ${low} à ${high}`);
                const pi = await partition(low, high);
                await quickSortHelper(low, pi - 1);
                await quickSortHelper(pi + 1, high);
            }
        };

        await quickSortHelper(0, workingArray.length - 1);

        if (!isBenchmark) {
            workingArray.forEach(item => item.isSorted = true);
            setArray([...workingArray]);
            setSorting(false);
            confetti();
        }

        currentStats.timeElapsed = Date.now() - startTime;
        if (!isBenchmark) addToHistory(currentStats);

        return workingArray;
    };

    // Merge Sort
    const mergeSort = async (arr: ArrayBar[], currentStats: SortStats, isBenchmark: boolean) => {
        const startTime = Date.now();
        if (!isBenchmark) setSorting(true);
        const workingArray = [...arr];

        const merge = async (left: number, mid: number, right: number) => {
            const n1 = mid - left + 1;
            const n2 = right - mid;
            const L = workingArray.slice(left, mid + 1);
            const R = workingArray.slice(mid + 1, right + 1);

            let i = 0, j = 0, k = left;

            while (i < n1 && j < n2) {
                if (!isBenchmark) {
                    workingArray[k].isComparing = true;
                    setArray([...workingArray]);
                    await sleep(speed);
                }

                currentStats.comparisons++;
                if (!isBenchmark) {
                    updateStats({ comparisons: currentStats.comparisons });
                }
                if (L[i].value <= R[j].value) {
                    workingArray[k] = {...L[i], isComparing: false};
                    i++;
                } else {
                    workingArray[k] = {...R[j], isComparing: false};
                    j++;
                }
                currentStats.swaps++;
                if (!isBenchmark) {
                    updateStats({ swaps: currentStats.swaps });
                }

                if (!isBenchmark) {
                    if (soundEnabled) playNote(400 + workingArray[k].value * 2);
                    setArray([...workingArray]);
                    await sleep(speed);
                }
                k++;
            }

            while (i < n1) {
                workingArray[k] = {...L[i], isComparing: false};
                i++;
                k++;
                currentStats.swaps++;
                if (!isBenchmark) {
                    updateStats({ swaps: currentStats.swaps });
                }
                if (!isBenchmark) {
                    setArray([...workingArray]);
                    await sleep(speed / 2);
                }
            }

            while (j < n2) {
                workingArray[k] = {...R[j], isComparing: false};
                j++;
                k++;
                currentStats.swaps++;
                if (!isBenchmark) {
                    updateStats({ swaps: currentStats.swaps });
                }
                if (!isBenchmark) {
                    setArray([...workingArray]);
                    await sleep(speed / 2);
                }
            }
        };
        const mergeSortHelper = async (left: number, right: number) => {
            if (left < right) {
                const mid = Math.floor((left + right) / 2);
                if (!isBenchmark) setCurrentStep(`Division: ${left} à ${right}`);
                await mergeSortHelper(left, mid);
                await mergeSortHelper(mid + 1, right);
                await merge(left, mid, right);
            }
        };

        await mergeSortHelper(0, workingArray.length - 1);

        if (!isBenchmark) {
            workingArray.forEach(item => item.isSorted = true);
            setArray([...workingArray]);
            setSorting(false);
            confetti();
        }

        currentStats.timeElapsed = Date.now() - startTime;
        if (!isBenchmark) addToHistory(currentStats);

        return workingArray;
    };

    // Heap Sort
    const heapSort = async (arr: ArrayBar[], currentStats: SortStats, isBenchmark: boolean) => {
        const startTime = Date.now();
        if (!isBenchmark) setSorting(true);
        const workingArray = [...arr];

        const heapify = async (n: number, i: number) => {
            let largest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;

            if (!isBenchmark) {
                workingArray[i].isComparing = true;
                if (left < n) workingArray[left].isComparing = true;
                if (right < n) workingArray[right].isComparing = true;
                setArray([...workingArray]);
                await sleep(speed);
            }

            currentStats.comparisons++;
            if (!isBenchmark) {
                updateStats({ comparisons: currentStats.comparisons });
            }
            if (left < n && workingArray[left].value > workingArray[largest].value) {
                largest = left;
            }

            currentStats.comparisons++;
            if (!isBenchmark) {
                updateStats({ comparisons: currentStats.comparisons });
            }
            if (right < n && workingArray[right].value > workingArray[largest].value) {
                largest = right;
            }

            if (largest !== i) {
                if (!isBenchmark) {
                    workingArray[i].isSwapping = true;
                    workingArray[largest].isSwapping = true;
                    setArray([...workingArray]);
                    await sleep(speed);
                }

                const temp = workingArray[i];
                workingArray[i] = workingArray[largest];
                workingArray[largest] = temp;
                currentStats.swaps++;
                if (!isBenchmark) {
                    updateStats({ swaps: currentStats.swaps });
                }

                if (!isBenchmark && soundEnabled) {
                    playNote(400 + workingArray[i].value * 2);
                }

                if (!isBenchmark) {
                    workingArray[i].isSwapping = false;
                    workingArray[largest].isSwapping = false;
                    setArray([...workingArray]);
                }

                await heapify(n, largest);
            }

            if (!isBenchmark) {
                workingArray[i].isComparing = false;
                if (left < n) workingArray[left].isComparing = false;
                if (right < n) workingArray[right].isComparing = false;
                setArray([...workingArray]);
            }
        };

        // Build heap
        for (let i = Math.floor(workingArray.length / 2) - 1; i >= 0; i--) {
            await heapify(workingArray.length, i);
        }

        // Extract elements
        for (let i = workingArray.length - 1; i > 0; i--) {
            if (!isBenchmark) {
                workingArray[0].isSwapping = true;
                workingArray[i].isSwapping = true;
                setArray([...workingArray]);
                await sleep(speed);
            }

            const temp = workingArray[0];
            workingArray[0] = workingArray[i];
            workingArray[i] = temp;
            currentStats.swaps++;
            if (!isBenchmark) {
                updateStats({ swaps: currentStats.swaps });
            }

            if (!isBenchmark) {
                workingArray[i].isSorted = true;
                workingArray[0].isSwapping = false;
                workingArray[i].isSwapping = false;
                if (soundEnabled) playNote(400 + workingArray[i].value * 2);
                setArray([...workingArray]);
            }

            await heapify(i, 0);
        }

        if (!isBenchmark) {
            workingArray[0].isSorted = true;
            setArray([...workingArray]);
            setSorting(false);
            confetti();
        }

        currentStats.timeElapsed = Date.now() - startTime;
        if (!isBenchmark) addToHistory(currentStats);

        return workingArray;
    };

    const startSorting = () => {
        pauseRef.current = false;
        setIsPaused(false);
        setStartTime(Date.now());
        setStats({ comparisons: 0, swaps: 0, timeElapsed: 0 });

        const currentArray = [...array];
        const currentStats = {comparisons: 0, swaps: 0, timeElapsed: 0};

        switch (algorithm) {
            case "bubble":
                bubbleSort(currentArray, currentStats, false);
                break;
            case "quick":
                quickSort(currentArray, currentStats, false);
                break;
            case "merge":
                mergeSort(currentArray, currentStats, false);
                break;
            case "heap":
                heapSort(currentArray, currentStats, false);
                break;
        }
    };

    const togglePause = () => {
        pauseRef.current = !pauseRef.current;
        setIsPaused(!isPaused);
    };

    // Fonction pour exécuter les benchmarks
    const runBenchmarks = async () => {
        const sizes = [10, 50, 100, 200, 500];
        const algorithms = ['bubble', 'quick', 'merge', 'heap'];
        const results: BenchmarkResult[] = [];

        for (const alg of algorithms) {
            const times: number[] = [];
            const comparisons: number[] = [];
            const swaps: number[] = [];

            for (const size of sizes) {
                const testArray = Array.from({length: size}, () =>
                    Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE
                ).map(value => ({
                    value,
                    isComparing: false,
                    isSorted: false,
                    isSwapping: false
                }));

                const testStats = {comparisons: 0, swaps: 0, timeElapsed: 0};
                const arrayToSort = [...testArray];

                try {
                    switch (alg) {
                        case 'bubble':
                            await bubbleSort(arrayToSort, testStats, true);
                            break;
                        case 'quick':
                            await quickSort(arrayToSort, testStats, true);
                            break;
                        case 'merge':
                            await mergeSort(arrayToSort, testStats, true);
                            break;
                        case 'heap':
                            await heapSort(arrayToSort, testStats, true);
                            break;
                    }

                    times.push(testStats.timeElapsed);
                    comparisons.push(testStats.comparisons);
                    swaps.push(testStats.swaps);
                } catch (error) {
                    console.error(`Erreur lors du benchmark de ${alg}:`, error);
                }
            }

            results.push({
                algorithm: alg,
                sizes,
                times,
                comparisons,
                swaps,
            });
        }

        setBenchmarkResults(results);
    };
    // Composant pour les graphiques de performance
    const PerformanceGraphs = ({data}: { data: BenchmarkResult[] }) => {
        const chartData = {
            labels: data[0].sizes,
            datasets: data.map((result, index) => ({
                label: result.algorithm,
                data: result.times,
                borderColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0'
                ][index],
                fill: false,
            })),
        };

        const options: ChartOptions<'line'> = {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top' as const,
                },
                title: {
                    display: true,
                    text: 'Performance des algorithmes de tri',
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Temps (ms)',
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: 'Taille du tableau',
                    },
                },
            },
        };

        return <Line data={chartData} options={options}/>;
    };

    // Rendu du composant
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-8 text-center">
                    Visualisation d&#39;Algorithmes de Tri
                </h1>

                <Card className="p-6 bg-gray-800 border-gray-700">
                    <div className="flex flex-wrap gap-4 mb-8">
                        <Select
                            disabled={sorting}
                            onValueChange={setAlgorithm}
                            defaultValue="bubble"
                        >
                            <SelectTrigger className="w-[180px] bg-white text-gray-900 border-gray-200 hover:bg-gray-100">
                                <SelectValue placeholder="Algorithme"/>
                            </SelectTrigger>
                            <SelectContent className="bg-white text-gray-900">
                                <SelectItem value="bubble" className="hover:bg-gray-100">Bubble Sort</SelectItem>
                                <SelectItem value="quick" className="hover:bg-gray-100">Quick Sort</SelectItem>
                                <SelectItem value="merge" className="hover:bg-gray-100">Merge Sort</SelectItem>
                                <SelectItem value="heap" className="hover:bg-gray-100">Heap Sort</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-4 flex-1">
                            <span className="text-white">Vitesse:</span>
                            <Slider
                                disabled={sorting}
                                value={[speed]}
                                onValueChange={(value) => setSpeed(value[0])}
                                min={1}
                                max={100}
                                step={1}
                                className="w-[200px]"
                            />
                        </div>

                        <Button
                            onClick={() => {
                                if (audioContext?.state === 'suspended') {
                                    audioContext.resume();
                                }
                                setSoundEnabled(!soundEnabled);
                            }}
                            variant="outline"
                            className={`${soundEnabled ? 'bg-green-600' : 'bg-gray-600'} text-white`}
                        >
                            {soundEnabled ? "🔊 Son activé" : "🔈 Son désactivé"}
                        </Button>

                        <Button
                            onClick={generateArray}
                            disabled={sorting}
                            variant="secondary"
                        >
                            Générer un nouveau tableau
                        </Button>

                        <Button
                            onClick={startSorting}
                            disabled={sorting && !isPaused}
                            variant="default"
                        >
                            {sorting && !isPaused ? "En cours..." : "Démarrer le tri"}
                        </Button>

                        {sorting && (
                            <Button onClick={togglePause} variant="outline">
                                {isPaused ? "Reprendre" : "Pause"}
                            </Button>
                        )}
                    </div>

                    <div className="mb-6">
                        <Tabs defaultValue="visualization" className="w-full">
                            <TabsList className="w-full justify-start bg-gray-700">
                                <TabsTrigger value="visualization" className="text-white">
                                    Visualisation
                                </TabsTrigger>
                                <TabsTrigger value="stats" className="text-white">
                                    Statistiques
                                </TabsTrigger>
                                <TabsTrigger value="analytics" className="text-white">
                                    Analyse
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="visualization" className="mt-4">
                                <div className="h-[400px] flex items-end justify-center gap-[2px]">
                                    <AnimatePresence>
                                        {array.map((bar, index) => (
                                            <motion.div
                                                key={index}
                                                layout
                                                initial={{opacity: 0, height: 0}}
                                                animate={{
                                                    opacity: 1,
                                                    height: `${bar.value * 3}px`,
                                                    backgroundColor: bar.isComparing
                                                        ? "#FFD700"
                                                        : bar.isSwapping
                                                            ? "#FF4444"
                                                            : bar.isSorted
                                                                ? "#4CAF50"
                                                                : "#3B82F6",
                                                }}
                                                transition={{duration: 0.2}}
                                                className="rounded-t-sm"
                                                style={{width: `${100 / ARRAY_SIZE}%`}}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </TabsContent>

                            <TabsContent value="stats" className="mt-4">
                                <Card className="p-4 bg-gray-700">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-gray-800 p-4 rounded-lg">
                                            <p className="text-white text-sm">Comparaisons</p>
                                            <p className="text-white text-2xl font-bold">{stats.comparisons}</p>
                                        </div>
                                        <div className="bg-gray-800 p-4 rounded-lg">
                                            <p className="text-white text-sm">Échanges</p>
                                            <p className="text-white text-2xl font-bold">{stats.swaps}</p>
                                        </div>
                                        <div className="bg-gray-800 p-4 rounded-lg">
                                            <p className="text-white text-sm">Temps</p>
                                            <p className="text-white text-2xl font-bold">
                                                {(stats.timeElapsed / 1000).toFixed(2)}s
                                            </p>
                                        </div>
                                        <div className="bg-gray-800 p-4 rounded-lg">
                                            <p className="text-white text-sm">État</p>
                                            <p className="text-white font-bold">{currentStep || "En attente..."}</p>
                                        </div>
                                    </div>
                                </Card>
                            </TabsContent>

                            <TabsContent value="analytics" className="mt-4">
                                <Card className="p-6 bg-gray-700">
                                    <div className="space-y-6">
                                        {/* Section Benchmarks */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-bold text-white">Benchmarks</h3>
                                                <Button onClick={runBenchmarks} disabled={sorting}>
                                                    Lancer les benchmarks
                                                </Button>
                                            </div>

                                            {benchmarkResults.length > 0 && (
                                                <div className="bg-gray-800 p-4 rounded-lg">
                                                    <PerformanceGraphs data={benchmarkResults}/>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section Historique */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xl font-bold text-white">Historique des tris</h3>
                                                <div className="space-x-2">
                                                    <Button
                                                        onClick={() => exportData('csv')}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Exporter CSV
                                                    </Button>
                                                    <Button
                                                        onClick={() => exportData('json')}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Exporter JSON
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="bg-gray-800 rounded-lg overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-white">Algorithme</TableHead>
                                                            <TableHead className="text-white">Taille</TableHead>
                                                            <TableHead className="text-white">Comparaisons</TableHead>
                                                            <TableHead className="text-white">Échanges</TableHead>
                                                            <TableHead className="text-white">Temps (ms)</TableHead>
                                                            <TableHead className="text-white">Date</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sortHistory.map((entry) => (
                                                            <TableRow key={entry.id}>
                                                                <TableCell className="text-white">
                                                                    {entry.algorithm}
                                                                </TableCell>
                                                                <TableCell className="text-white">
                                                                    {entry.arraySize}
                                                                </TableCell>
                                                                <TableCell className="text-white">
                                                                    {entry.comparisons}
                                                                </TableCell>
                                                                <TableCell className="text-white">
                                                                    {entry.swaps}
                                                                </TableCell>
                                                                <TableCell className="text-white">
                                                                    {entry.timeElapsed}
                                                                </TableCell>
                                                                <TableCell className="text-white">
                                                                    {new Date(entry.timestamp).toLocaleString()}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {/* Section Statistiques comparatives */}
                                        <div className="space-y-4">
                                            <h3 className="text-xl font-bold text-white">Statistiques comparatives</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Card className="p-4 bg-gray-800">
                                                    <h4 className="text-lg font-semibold text-white mb-2">
                                                        Moyenne des temps d&#39;exécution
                                                    </h4>
                                                    {Object.entries(averageStats).map(([alg, stats]) => (
                                                        <div key={alg} className="flex justify-between text-white">
                                                            <span>{alg}:</span>
                                                            <span>{(stats.total / stats.count).toFixed(2)} ms</span>
                                                        </div>
                                                    ))}
                                                </Card>

                                                <Card className="p-4 bg-gray-800">
                                                    <h4 className="text-lg font-semibold text-white mb-2">
                                                        Nombre moyen de comparaisons
                                                    </h4>
                                                    {Object.entries(
                                                        sortHistory.reduce((acc, curr) => {
                                                            acc[curr.algorithm] = acc[curr.algorithm] || {
                                                                total: 0,
                                                                count: 0
                                                            };
                                                            acc[curr.algorithm].total += curr.comparisons;
                                                            acc[curr.algorithm].count += 1;
                                                            return acc;
                                                        }, {} as Record<string, { total: number; count: number }>)
                                                    ).map(([alg, stats]) => (
                                                        <div key={alg} className="flex justify-between text-white">
                                                            <span>{alg}:</span>
                                                            <span>{Math.round(stats.total / stats.count)}</span>
                                                        </div>
                                                    ))}
                                                </Card>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </Card>
            </div>
        </div>
    );
}