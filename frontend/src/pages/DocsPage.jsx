import { useEffect, useState } from "react";

async function fetchGuide(signal) {
  const response = await fetch("/docs", {
    headers: { Accept: "application/json" },
    signal,
  });

  let guide;
  try {
    guide = await response.json();
  } catch {
    throw new Error("Máy chủ trả về cẩm nang không hợp lệ.");
  }

  if (!response.ok) {
    throw new Error(guide?.error || "Không thể tải cẩm nang.");
  }
  if (!guide || !Array.isArray(guide.sections)) {
    throw new Error("Dữ liệu cẩm nang chưa đầy đủ.");
  }
  return guide;
}

function GuideBlock({ block }) {
  if (block.type === "list" || block.type === "steps") {
    const ListTag = block.type === "steps" ? "ol" : "ul";
    return (
      <ListTag className={`guide-list${block.type === "steps" ? " guide-list--steps" : ""}`}>
        {(block.items || []).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ListTag>
    );
  }

  if (block.type === "callout") {
    return (
      <aside className="guide-callout">
        {block.title && <h3>{block.title}</h3>}
        {block.text && <p>{block.text}</p>}
      </aside>
    );
  }

  return <p className="guide-paragraph">{block.text}</p>;
}

function isSafeSourceURL(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function RuleProfile({ ruleProfile }) {
  return (
    <section className="rule-profile" aria-labelledby="rule-profile-heading">
      <div className="rule-profile-heading">
        <p className="eyebrow">LUẬT ĐANG DÙNG</p>
        <h2 id="rule-profile-heading">Hồ sơ luật của ứng dụng</h2>
      </div>
      <dl className="rule-profile-grid">
        <div className="rule-profile-item">
          <dt>Kích thước bàn</dt>
          <dd>{ruleProfile.boardSizes.map((size) => `${size}×${size}`).join(" · ")}</dd>
        </div>
        <div className="rule-profile-item">
          <dt>Người đi trước</dt>
          <dd>{ruleProfile.firstPlayer}</dd>
        </div>
        <div className="rule-profile-item">
          <dt>Ko</dt>
          <dd>{ruleProfile.koRule}</dd>
        </div>
        <div className="rule-profile-item">
          <dt>Tính điểm</dt>
          <dd>{ruleProfile.scoring}</dd>
        </div>
        <div className="rule-profile-item">
          <dt>Komi cho Trắng</dt>
          <dd>{ruleProfile.whiteKomi}</dd>
        </div>
        <div className="rule-profile-item rule-profile-item--wide">
          <dt>Giới hạn cuối ván</dt>
          <dd>{ruleProfile.endgameLimitation}</dd>
        </div>
      </dl>
    </section>
  );
}

function GuideContents({ guide }) {
  return (
    <>
      <div className="docs-heading">
        <p className="eyebrow">TỪ LUẬT CƠ BẢN ĐẾN CHIẾN LƯỢC</p>
        <h1>{guide.title}</h1>
        <p className="docs-introduction">{guide.introduction}</p>
      </div>

      {guide.ruleProfile && <RuleProfile ruleProfile={guide.ruleProfile} />}

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="Nội dung cẩm nang">
          <p className="eyebrow">TRONG CẨM NANG</p>
          <ol>
            {guide.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
            {guide.sources?.length > 0 && <li><a href="#nguon-tham-khao">Nguồn tham khảo</a></li>}
          </ol>
        </nav>

        <div className="docs-article">
          {guide.sections.map((section) => (
            <section className="guide-section" id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => <GuideBlock block={block} key={`${section.id}-${index}`} />)}
            </section>
          ))}

          {guide.sources?.length > 0 && (
            <section className="guide-section guide-sources" id="nguon-tham-khao">
              <h2>Nguồn tham khảo</h2>
              <p className="guide-paragraph">Cẩm nang được biên soạn lại bằng tiếng Việt từ các tài liệu luật và hướng dẫn dưới đây.</p>
              <ul className="source-list">
                {guide.sources.map((source) => (
                  <li key={source.id}>
                    {isSafeSourceURL(source.url) ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                    ) : <span>{source.title}</span>}
                    <p>{source.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function DocsPage() {
  const [guide, setGuide] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage("");

    fetchGuide(controller.signal)
      .then(setGuide)
      .catch((error) => {
        if (error.name !== "AbortError") setErrorMessage(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [attempt]);

  if (isLoading) {
    return <main className="docs-state" id="main-content" role="status" aria-live="polite">Đang tải cẩm nang…</main>;
  }

  if (errorMessage) {
    return (
      <main className="docs-state docs-state--error" id="main-content" role="alert">
        <p className="eyebrow">CHƯA TẢI ĐƯỢC</p>
        <h1>Cẩm nang đang tạm thời không khả dụng</h1>
        <p className="page-intro">{errorMessage}</p>
        <button type="button" className="button button--secondary retry-button" onClick={() => setAttempt((value) => value + 1)}>
          Thử tải lại
        </button>
      </main>
    );
  }

  return (
    <main className="docs-main" id="main-content" data-enter>
      <GuideContents guide={guide} />
    </main>
  );
}
