import React from "react";

type Props = {
  text: string;
};

export function Markdown({ text }: Props) {
  if (!text) return null;

  // Split content by lines
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  // Parse inline elements: **bold**
  const parseInline = (str: string): React.ReactNode[] => {
    const parts = str.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i}>{part}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check for headers
    if (trimmed.startsWith("### ")) {
      if (inList) {
        elements.push(<ul key={`list-${index}`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      elements.push(
        <h3 key={index} style={{ margin: "10px 0 4px 0", fontSize: "14.5px", fontWeight: "bold" }}>
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      if (inList) {
        elements.push(<ul key={`list-${index}`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      elements.push(
        <h2 key={index} style={{ margin: "14px 0 6px 0", fontSize: "16px", fontWeight: "bold" }}>
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      return;
    }

    // Check for list items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      listItems.push(
        <li key={index} style={{ marginBottom: "3px", listStyleType: "disc" }}>
          {parseInline(trimmed.slice(2))}
        </li>
      );
      return;
    }

    // Check for tables
    if (trimmed.startsWith("|")) {
      if (inList) {
        elements.push(<ul key={`list-${index}`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      if (trimmed.includes("---")) return; // ignore separator
      
      const cells = trimmed.split("|").map(c => c.trim()).filter(Boolean);
      elements.push(
        <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: index % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent", fontSize: "13px" }}>
          {cells.map((cell, ci) => (
            <span key={ci} style={{ fontWeight: line.includes("Plan") || index === 0 ? 600 : "normal" }}>
              {parseInline(cell)}
            </span>
          ))}
        </div>
      );
      return;
    }

    // Empty line
    if (trimmed === "") {
      if (inList) {
        elements.push(<ul key={`list-${index}`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      return;
    }

    // Regular paragraph line
    if (inList) {
      elements.push(<ul key={`list-${index}`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
      listItems = [];
      inList = false;
    }
    elements.push(
      <p key={index} style={{ margin: "0 0 6px 0", lineHeight: "1.4" }}>
        {parseInline(trimmed)}
      </p>
    );
  });

  if (inList) {
    elements.push(<ul key={`list-end`} style={{ margin: "6px 0 10px 18px", padding: 0 }}>{listItems}</ul>);
  }

  return <div className="markdown-body" style={{ wordBreak: "break-word" }}>{elements}</div>;
}
