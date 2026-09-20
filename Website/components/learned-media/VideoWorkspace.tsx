"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { YouTubeChannelRecord, YouTubeImportProgress, YouTubeTopic, YouTubeVideo, YouTubeWorkspaceState } from "@/lib/youtube";
import { YOUTUBE_TOPICS, filterYouTubeVideos } from "@/lib/youtube";
import type { RankedVideoSearchResult } from "@/lib/gemini";
import { Icon } from "./icons";

type VideoWorkspaceProps = {
  workspace: YouTubeWorkspaceState;
  youtubeStatus: "not-configured" | "connecting" | "refreshing" | "connected" | "error";
  progress: YouTubeImportProgress;
  error?: string;
  searchResults: YouTubeVideo[];
  searchReasons: Record<string, RankedVideoSearchResult>;
  smartSearchLoading: boolean;
  searchPhase: "idle" | "interpreting" | "checking" | "expanding" | "error";
  smartSearchRan: boolean;
  onOpenSettings: () => void;
  onTabChange: (tab: YouTubeWorkspaceState["activeTab"]) => void;
  onSearchChange: (value: string) => void;
  onSmartSearch: () => void;
  onCancelSearch: () => void;
  onTopicChange: (topic: YouTubeTopic | "All") => void;
  onShuffle: () => void;
  onShowMore: () => void;
  onOpenVideo: (id: string) => void;
  onOpenChannel: (id: string) => void;
  onBack: () => void;
  onSaveVideo: (id: string) => void;
  onPlaybackPosition: (id: string, seconds: number) => void;
  onChannelOrder: (order: YouTubeWorkspaceState["channelOrder"]) => void;
  onPauseImport: () => void;
  onResumeImport: () => void;
  onRetryImport: () => void;
  onRefreshVideos: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function videoUrl(id: string) { return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`; }

function VideoCard({ video, saved, reason, onOpen, onSave }: { video: YouTubeVideo; saved: boolean; reason?: RankedVideoSearchResult; onOpen: () => void; onSave: () => void }) {
  return <article className="video-card">
    <button type="button" className="video-card-main" onClick={onOpen} aria-label={`Watch ${video.title}`}>
      <div className="video-thumbnail">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <span><Icon name="image" size={22} /></span>}<small>{video.durationLabel}</small></div>
      <div className="video-card-copy"><h3>{video.title}</h3><p>{video.channelName}</p><time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time></div>
    </button>
    <button type="button" className={`video-save-button ${saved ? "saved" : ""}`} onClick={onSave} aria-label={saved ? "Remove from saved videos" : "Save video"}><Icon name="bookmark" size={16} /></button>
    {reason && <details className="video-match-reason"><summary>Why this matches</summary><p>{reason.explanation}</p><small>{reason.support.join(" · ")}</small></details>}
  </article>;
}

function VideoList({ videos, workspace, reasons, smartSearchRan, onOpenVideo, onSaveVideo }: { videos: YouTubeVideo[]; workspace: YouTubeWorkspaceState; reasons?: Record<string, RankedVideoSearchResult>; smartSearchRan?: boolean; onOpenVideo: (id: string) => void; onSaveVideo: (id: string) => void }) {
  if (!videos.length) return <div className="video-empty"><div className="empty-orbit"><Icon name="search" size={24} /></div><h2>{smartSearchRan ? "No relevant approved videos found" : "No approved videos match that yet"}</h2><p>{smartSearchRan ? "Gemini could not support a match in the approved catalog. Try another phrase or remove a conflicting filter." : "Try another phrase, topic, or channel. The search stays inside the approved collection."}</p></div>;
  return <div className="video-grid">{videos.map((video) => <VideoCard key={video.id} video={video} saved={workspace.savedIds.includes(video.id)} reason={reasons?.[video.id]} onOpen={() => onOpenVideo(video.id)} onSave={() => onSaveVideo(video.id)} />)}</div>;
}

export function VideoWorkspace({ workspace, youtubeStatus, progress, error, searchResults, searchReasons, smartSearchLoading, searchPhase, smartSearchRan, onOpenSettings, onTabChange, onSearchChange, onSmartSearch, onCancelSearch, onTopicChange, onShuffle, onShowMore, onOpenVideo, onOpenChannel, onBack, onSaveVideo, onPlaybackPosition, onChannelOrder, onPauseImport, onResumeImport, onRetryImport, onRefreshVideos }: VideoWorkspaceProps) {
  const [ended, setEnded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeVideo = workspace.selectedVideoId ? workspace.videos.find((video) => video.id === workspace.selectedVideoId) : undefined;
  const activeChannel = workspace.selectedChannelId ? workspace.channels.find((channel) => channel.id === workspace.selectedChannelId) : undefined;
  const channelVideos = activeChannel ? (smartSearchRan ? searchResults.filter((video) => video.channelId === activeChannel.id) : filterYouTubeVideos(workspace.videos, workspace.searchText, workspace.selectedTopic, activeChannel.id)) : [];
  const historyVideos = workspace.history.map((item) => workspace.videos.find((video) => video.id === item.videoId)).filter((video): video is YouTubeVideo => Boolean(video));
  const savedVideos = workspace.videos.filter((video) => workspace.savedIds.includes(video.id));
  const related = activeVideo ? workspace.videos.filter((video) => video.id !== activeVideo.id && video.topics.some((topic) => activeVideo.topics.includes(topic))).slice(0, 6) : [];

  useEffect(() => {
    setEnded(false);
    if (!activeVideo) return;
    const onMessage = (event: MessageEvent) => {
      if (!String(event.origin).includes("youtube.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) as { event?: string; info?: number | { currentTime?: number } } : event.data as { event?: string; info?: number | { currentTime?: number } };
        if (data?.event === "onStateChange" && data.info === 0) setEnded(true);
        if (data?.event === "infoDelivery" && typeof data.info === "object" && typeof data.info.currentTime === "number") onPlaybackPosition(activeVideo.id, data.info.currentTime);
      } catch { /* YouTube also emits non-JSON messages. */ }
    };
    const requestPosition = () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "https://www.youtube.com");
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(requestPosition, 5000);
    return () => { window.removeEventListener("message", onMessage); window.clearInterval(timer); };
  }, [activeVideo?.id, onPlaybackPosition]);

  if (activeVideo) return <section className="content-view video-workspace">
    <button type="button" className="text-button video-back-button" onClick={onBack}><Icon name="chevronRight" size={15} /> Back to videos</button>
    <div className="video-player-layout">
      <div className="video-player-column">
        <div className="video-player-shell">{activeVideo.embedAvailable ? <iframe ref={iframeRef} title={activeVideo.title} src={`https://www.youtube.com/embed/${encodeURIComponent(activeVideo.id)}?enablejsapi=1&origin=https%3A%2F%2Fstiwarilbj.github.io&rel=0&playsinline=1${workspace.playbackPositions[activeVideo.id] ? `&start=${Math.max(0, Math.floor(workspace.playbackPositions[activeVideo.id]))}` : ""}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div className="video-unavailable"><Icon name="external" size={24} /><strong>Watch this one on YouTube</strong><a href={videoUrl(activeVideo.id)} target="_blank" rel="noreferrer">Open video</a></div>}</div>
        <div className="video-player-heading"><div><span className="eyebrow">Now watching</span><h1>{activeVideo.title}</h1><p>{activeVideo.channelName} · {formatDate(activeVideo.publishedAt)} · {activeVideo.durationLabel}</p></div><button type="button" className={`secondary-button ${workspace.savedIds.includes(activeVideo.id) ? "selected" : ""}`} onClick={() => onSaveVideo(activeVideo.id)}><Icon name="bookmark" size={15} /> {workspace.savedIds.includes(activeVideo.id) ? "Saved" : "Save video"}</button></div>
        <div className="video-player-links"><a className="ghost-button" href={videoUrl(activeVideo.id)} target="_blank" rel="noreferrer">Watch on YouTube <Icon name="external" size={13} /></a><span>{activeVideo.topics.join(" · ")}</span></div>
        {ended && related.length > 0 && <section className="video-related"><div className="section-heading"><div><span className="eyebrow">Up next to explore</span><h2>More like this</h2></div></div><VideoList videos={related} workspace={workspace} onOpenVideo={onOpenVideo} onSaveVideo={onSaveVideo} /></section>}
      </div>
    </div>
  </section>;

  if (activeChannel) return <section className="content-view video-workspace">
    <button type="button" className="text-button video-back-button" onClick={onBack}><Icon name="chevronRight" size={15} /> All channels</button>
    <div className="view-heading video-heading"><div><span className="eyebrow">Channel catalog</span><h1>{activeChannel.name}</h1><p>{activeChannel.videoCount.toLocaleString()} imported videos from this approved channel</p></div></div>
    <div className="video-controls"><label className="video-search"><Icon name="search" size={16} /><input value={workspace.searchText} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search this channel" aria-label="Search this channel" /></label><button type="button" className="ghost-button" onClick={onSmartSearch} disabled={smartSearchLoading || !workspace.searchText.trim()}>{smartSearchLoading ? "Searching" : "Smart search"}</button><select value={workspace.channelOrder} onChange={(event) => onChannelOrder(event.target.value as YouTubeWorkspaceState["channelOrder"])} aria-label="Sort channel videos"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="random">Random</option></select></div>
    <SearchProgress loading={smartSearchLoading} phase={searchPhase} onCancel={onCancelSearch} />
    {searchPhase === "error" && error && <p className="video-search-error" role="alert">{error}</p>}
    <VideoList videos={channelVideos} workspace={workspace} reasons={searchReasons} smartSearchRan={smartSearchRan} onOpenVideo={onOpenVideo} onSaveVideo={onSaveVideo} />
  </section>;

  const sortedChannels = [...workspace.channels].sort((a, b) => a.name.localeCompare(b.name));
  if (workspace.activeTab === "channels") return <section className="content-view video-workspace"><div className="view-heading video-heading"><div><span className="eyebrow">Approved creators</span><h1>Channels worth wandering through.</h1><p>Every catalog here is limited to the channels you approved.</p></div></div>{workspace.libraryIncomplete && <ImportNotice progress={progress} error={error} onPause={onPauseImport} onResume={onResumeImport} onRetry={onRetryImport} />}{sortedChannels.length ? <div className="channel-grid">{sortedChannels.map((channel) => <button type="button" className="channel-card" key={channel.id} onClick={() => onOpenChannel(channel.id)}>{channel.thumbnailUrl ? <img src={channel.thumbnailUrl} alt="" /> : <span className="channel-avatar">{channel.name.slice(0, 1)}</span>}<span><strong>{channel.name}</strong><small>{channel.videoCount.toLocaleString()} videos</small></span><Icon name="chevronRight" size={17} /></button>)}</div> : <EmptyVideoSetup onOpenSettings={onOpenSettings} />}</section>;

  let videos = searchResults;
  if (workspace.activeTab === "saved") videos = savedVideos;
  if (workspace.activeTab === "history") videos = historyVideos;
  const title = workspace.activeTab === "saved" ? "Saved videos" : workspace.activeTab === "history" ? "Watch history" : "A calmer way to find something good.";
  return <section className="content-view video-workspace">
    <div className="view-heading video-heading"><div><span className="eyebrow">Learned Media Videos</span><h1>{title}</h1><p>Discover approved creators, search their full imported catalogs, and watch without leaving your workspace.</p></div><div className="video-heading-actions"><button type="button" className="secondary-button" onClick={onRefreshVideos} disabled={youtubeStatus === "connecting" || youtubeStatus === "refreshing"}><Icon name="reset" size={15} /> Refresh videos</button><button type="button" className="secondary-button" onClick={onShuffle} disabled={!workspace.videos.length}><Icon name="reset" size={15} /> Shuffle</button><button type="button" className="primary-button small" onClick={onShowMore} disabled={!workspace.videos.length}><Icon name="plus" size={15} /> Show more</button></div></div>
    {(youtubeStatus === "connecting" || youtubeStatus === "refreshing") && <ImportNotice progress={progress} error={error} onPause={onPauseImport} onResume={onResumeImport} onRetry={onRetryImport} />}
    {youtubeStatus === "error" && <ImportNotice progress={progress} error={error} onPause={onPauseImport} onResume={onResumeImport} onRetry={onRetryImport} />}
    {workspace.libraryIncomplete && youtubeStatus !== "connecting" && youtubeStatus !== "refreshing" && <div className="video-incomplete"><Icon name="help" size={15} /> This library is still incomplete. You can browse now and resume importing from Settings.</div>}
    <div className="video-tabs" role="tablist" aria-label="Video views">{([["discover", "Discover"], ["channels", "Channels"], ["saved", "Saved"], ["history", "History"]] as const).map(([tab, label]) => <button type="button" role="tab" aria-selected={workspace.activeTab === tab} className={workspace.activeTab === tab ? "active" : ""} key={tab} onClick={() => onTabChange(tab)}>{label}{tab === "saved" && workspace.savedIds.length ? <small>{workspace.savedIds.length}</small> : null}</button>)}</div>
    {workspace.activeTab === "discover" && <>
      <div className="video-controls"><label className="video-search"><Icon name="search" size={16} /><input value={workspace.searchText} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search approved videos" aria-label="Search approved videos" /></label><button type="button" className="ghost-button" onClick={onSmartSearch} disabled={smartSearchLoading || !workspace.searchText.trim()}>{smartSearchLoading ? "Searching" : "Smart search"}</button></div>
      <SearchProgress loading={smartSearchLoading} phase={searchPhase} onCancel={onCancelSearch} />
      {searchPhase === "error" && error && <p className="video-search-error" role="alert">{error}</p>}
      <div className="video-topic-filters" aria-label="Video topics"><button type="button" className={workspace.selectedTopic === "All" ? "active" : ""} onClick={() => onTopicChange("All")}>All topics</button>{YOUTUBE_TOPICS.map((topic) => <button type="button" key={topic} className={workspace.selectedTopic === topic ? "active" : ""} onClick={() => onTopicChange(topic)}>{topic}</button>)}</div>
    </>}
    {workspace.videos.length ? <VideoList videos={videos} workspace={workspace} reasons={searchReasons} smartSearchRan={smartSearchRan} onOpenVideo={onOpenVideo} onSaveVideo={onSaveVideo} /> : <EmptyVideoSetup onOpenSettings={onOpenSettings} />}
    {workspace.activeTab === "discover" && workspace.videos.length > 0 && <div className="video-show-more"><button type="button" className="small-load-button" onClick={onShowMore}>Show more approved videos</button></div>}
    {workspace.videos.length > 0 && <p className="video-library-note">{workspace.videos.length.toLocaleString()} approved videos available · No view, like, or comment counts are shown{workspace.lastSyncAt ? ` · Last refresh ${new Date(workspace.lastSyncAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>}
    {void onPlaybackPosition}
  </section>;
}

function SearchProgress({ loading, phase, onCancel }: { loading: boolean; phase: VideoWorkspaceProps["searchPhase"]; onCancel: () => void }) {
  if (!loading) return null;
  const label = phase === "interpreting" ? "Understanding your search" : phase === "expanding" ? "Looking more broadly" : "Checking matches";
  return <div className="video-search-progress" role="status"><span>{label}</span><button type="button" className="text-button" onClick={onCancel}>Cancel</button></div>;
}

function ImportNotice({ progress, error, onPause, onResume, onRetry }: { progress: YouTubeImportProgress; error?: string; onPause: () => void; onResume: () => void; onRetry: () => void }) {
  const completed = `${progress.completedChannels}/${progress.totalChannels} channels`;
  return <div className="video-import-notice" role="status"><div><strong>{progress.phase === "paused" ? "Import paused" : "Building your approved library"}</strong><span>{completed} · {progress.importedVideos.toLocaleString()} videos imported{error ? ` · ${error}` : ""}</span></div>{progress.phase === "paused" ? <button type="button" className="ghost-button" onClick={onResume}>Resume</button> : progress.phase === "complete" || progress.phase === "error" ? <button type="button" className="ghost-button" onClick={onRetry}>Retry</button> : <button type="button" className="ghost-button" onClick={onPause}>Pause</button>}</div>;
}

function EmptyVideoSetup({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <div className="video-empty"><div className="empty-orbit"><Icon name="image" size={24} /></div><h2>Connect YouTube to start discovering</h2><p>Paste your own YouTube Data API key in Settings. The catalog stays limited to the approved creators and videos.</p><button type="button" className="primary-button" onClick={onOpenSettings}>Open video settings</button></div>;
}
