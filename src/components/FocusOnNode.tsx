import { useCamera } from "@react-sigma/core";
import { useEffect } from "react";

interface FocusOnNodeProps {
  node: string | null;
}

export const FocusOnNode: React.FC<FocusOnNodeProps> = ({ node }) => {
  const { gotoNode } = useCamera({ duration: 1000 });

  useEffect(() => {
    if (node) {
      gotoNode(node);
    }
  }, [node, gotoNode]);

  return null;
};
