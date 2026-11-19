export function HomePage() {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="eyebrow">SPECIFICATION WORKSPACE</p>
      <h1 id="welcome-title">From Requirements to Reliable Software.</h1>
      <p className="intro">
        A clear place to turn software requirements into dependable engineering
        work.
      </p>
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          ＋
        </div>
        <h2>Your workspace is ready</h2>
        <p>Project workflows will appear here as they are introduced.</p>
      </div>
    </section>
  );
}
