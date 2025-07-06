// Define types for CSV data
export interface NodeData {
    id: string;
    title: string;
    group: string;
    size: string;
    depth: string;
}

export interface LinkData {
    source: string;
    target: string;
    value: string;
}
