import React from "react";

export function AboutSection({ aboutInfo, isAboutExpanded, setIsAboutExpanded }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <h2>About</h2>
      </div>

      <div className="about-card">
        <p className="about-description">
          {isAboutExpanded
            ? aboutInfo.description
            : `${String(aboutInfo.description).slice(0, 190)}${String(aboutInfo.description).length > 190 ? "..." : ""}`}

          {String(aboutInfo.description).length > 190 && (
            <button type="button" className="read-more-btn" onClick={() => setIsAboutExpanded((prev) => !prev)}>
              {isAboutExpanded ? "Read less" : "Read more"}
            </button>
          )}
        </p>
      </div>
    </section>
  );
}