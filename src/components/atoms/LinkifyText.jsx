import React from "react";

const LinkifyText = ({ details }) => {
  const linkify = (text) => {
    if (!text) return "No data";

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text
      .split("\n") // Preserve line breaks
      .map((line, index) => (
        <React.Fragment key={index}>
          {line.split(urlRegex).map((part, i) =>
            urlRegex.test(part) ? (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "blue", textDecoration: "underline" }}
              >
                {part}
              </a>
            ) : (
              part
            )
          )}
          <br />
        </React.Fragment>
      ));
  };

  return (
    <span
      style={{
        wordWrap: "break-word",
        whiteSpace: "pre-wrap", // Ensures line breaks are preserved
        fontSize: "9pt",
      }}
    >
      {linkify(details)}
    </span>
  );
};

export default LinkifyText;
