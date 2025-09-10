// Prerequisites data for various courses

export type GroupNode = {
    type: "group";
    logic: "ONE_OF" | "ALL_OF";
    children: PrereqNode[];
};

export type TranscriptNode = {
    type: "transcript";
    course: string;
    minGrade?: string;
    canBeTakenConcurrently?: string;
    orEquivalent?: boolean;
};

export type CreditCountNode = {
    type: "creditCount";
    creditCount: number;
};

export type NoteNode = {
    type: "note";
    text: string;
};

export type OtherNode = {
    type: "other";
    text: string;
};

export type PrereqNode = GroupNode | TranscriptNode | CreditCountNode | NoteNode | OtherNode | null;

export type CourseData = {
    title?: string;
    prerequisites: PrereqNode;
};

// All prerequisite data organized by course
export const prerequisiteData: Record<string, CourseData> = {
    "ECON 305": {
        title: "Intermediate Macroeconomic Theory",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "ECON 201",
                            minGrade: "C-"
                        },
                        {
                            type: "creditCount",
                            creditCount: 45
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "ECON 103",
                            minGrade: "A-"
                        },
                        {
                            type: "transcript",
                            course: "ECON 105",
                            minGrade: "A-"
                        },
                        {
                            type: "transcript",
                            course: "ECON 201",
                            canBeTakenConcurrently: "true"
                        },
                        {
                            type: "creditCount",
                            creditCount: 30
                        },
                        {
                            type: "note",
                            text: "Students seeking permission to enroll on this basis must contact the undergraduate advisor in economics."
                        }
                    ]
                }
            ]
        }
    },

    "ECON 201": {
        title: "Microeconomic Theory I: Competitive Behavior",
        prerequisites: {
            type: "group",
            logic: "ALL_OF",
            children: [
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "ECON 103",
                            minGrade: "C-"
                        },
                        {
                            type: "transcript",
                            course: "ECON 113",
                            minGrade: "B-"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "ECON 105",
                            minGrade: "C-"
                        },
                        {
                            type: "transcript",
                            course: "ECON 115",
                            minGrade: "B-"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 150",
                            minGrade: "C-"
                        },
                        {
                            type: "transcript",
                            course: "MATH 151",
                            minGrade: "C-"
                        },
                        {
                            type: "transcript",
                            course: "MATH 154",
                            minGrade: "C-"
                        },
                        {
                            type: "transcript",
                            course: "MATH 157",
                            minGrade: "C-"
                        }
                    ]
                }
            ]
        }
    },

    "MATH 150": {
        title: "Calculus I with Review",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "B+"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 100",
                            minGrade: "B-"
                        }
                    ]
                }
            ]
        }
    },

    "MATH 151": {
        title: "Calculus I",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "A"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 100",
                            minGrade: "B"
                        }
                    ]
                }
            ]
        }
    },

    "MATH 154": {
        title: "Mathematics for the Life Sciences I",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "B"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 100",
                            minGrade: "C-"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 110",
                            minGrade: "C-"
                        }
                    ]
                }
            ]
        }
    },

    "MATH 157": {
        title: "Calculus I for the Social Sciences",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "B"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 100",
                            minGrade: "C"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "MATH 110",
                            minGrade: "C"
                        }
                    ]
                }
            ]
        }
    },

    "MATH 100": {
        title: "Pre-Precalculus",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 11",
                            minGrade: "B"
                        },
                        {
                            type: "transcript",
                            course: "Foundations of Mathematics 11",
                            minGrade: "B",
                            orEquivalent: true
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "C"
                        },
                        {
                            type: "other",
                            text: "SFU FAN credit"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "SFU FAN X92",
                            minGrade: "B-"
                        },
                        {
                            type: "transcript",
                            course: "SFU FAN X99",
                            minGrade: "B-"
                        }
                    ]
                },
                {
                    type: "other",
                    text: "achieving a satisfactory grade on the Simon Fraser University Quantitative Placement Test"
                }
            ]
        }
    },

    "MATH 110": {
        title: "Precalculus for the Life Sciences and Social Sciences",
        prerequisites: {
            type: "group",
            logic: "ONE_OF",
            children: [
                {
                    type: "transcript",
                    course: "Foundations of Mathematics 11",
                    minGrade: "B",
                    orEquivalent: true
                },
                {
                    type: "group",
                    logic: "ALL_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "Pre-Calculus 12",
                            minGrade: "C"
                        },
                        {
                            type: "other",
                            text: "SFU FAN credit"
                        }
                    ]
                },
                {
                    type: "group",
                    logic: "ONE_OF",
                    children: [
                        {
                            type: "transcript",
                            course: "SFU FAN X92",
                            minGrade: "B-"
                        },
                        {
                            type: "transcript",
                            course: "SFU FAN X99",
                            minGrade: "B-"
                        }
                    ]
                },
                {
                    type: "other",
                    text: "achieving a satisfactory grade on the Simon Fraser University Quantitative Placement Test"
                }
            ]
        }
    },

    "ECON 103": {
        title: "Principles of Microeconomics",
        prerequisites: null
    },
    "ECON 105": {
        title: "Principles of Macroeconomics",
        prerequisites: null
    },
    "ECON 113": {
        title: "Introduction to Microeconomics",
        prerequisites: null
    },
    "ECON 115": {
        title: "Introduction to Macroeconomics",
        prerequisites: null
    },
    "SFU FAN X92": {
        title: "Foundations of Analytical and Quantitative Reasoning II",
        prerequisites: {
            type: "transcript",
            course: "SFU FAN X91",
            minGrade: "C"
        }
    },
    "SFU FAN X91": {
        title: "Foundations of Analytical and Quantitative Reasoning I",
        prerequisites: null
    },
    "SFU FAN X99": {
        title: "Foundations of Analytical and Quantitative Reasoning",
        prerequisites: null
    }
};
