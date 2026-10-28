(function () {
  "use strict";
  const background = window.LEARNED_MEDIA_BACKGROUND;

  const policy = window.LEARNED_MEDIA_SHARED.youtube;
  const CHANNELS = policy.APPROVED_YOUTUBE_CHANNELS.map(function(seed){return [seed.name,seed.handle,seed.channelId,seed.playlistIds,seed.titleAliases];});
  const DEFAULT_RECENCY_PREFERENCES = policy.DEFAULT_YOUTUBE_RECENCY_PREFERENCES;
  const INDIVIDUALS = policy.APPROVED_INDIVIDUAL_VIDEOS.map(function(seed){return [seed.creator,seed.title,seed.videoId];});
  const TOPICS = policy.YOUTUBE_TOPICS;
  const THREE_BLUE = "UCYO_jab_esuFRV4b17AJtAw";
  const THREE_BLUE_PLAYLISTS = ["PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"];

  // Match the website projection; retain all thumbnail dimensions for Shorts checks.
  const YOUTUBE_RESPONSE_FIELDS = {
    channels: "etag,items(id,snippet(title,customUrl,thumbnails),contentDetails(relatedPlaylists(uploads)))",
    search: "etag,items(id(channelId,videoId),snippet(title,channelTitle,channelId))",
    playlistItems: "etag,nextPageToken,items(contentDetails(videoId),snippet(title,description))",
    videos: "etag,items(id,snippet(channelId,channelTitle,title,description,tags,publishedAt,thumbnails),contentDetails(duration),status(privacyStatus,embeddable))",
  };
  function request(resource, params, key) {
    const fields = YOUTUBE_RESPONSE_FIELDS[resource];
    return window.__learnedMediaNativeRequest("youtubeRequest", { resource: resource, params: fields ? Object.assign({}, params, { fields: fields }) : params, key: key });
  }
  function norm(value) { return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
  function duration(value) { const match = String(value || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0; }
  function durationLabel(seconds) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = seconds % 60; return hours ? hours + ":" + String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0") : minutes + ":" + String(rest).padStart(2, "0"); }
  function topics(channel, title, description, tags) {
    const text = norm([channel, title, description].concat(tags || []).join(" "));
    const rules = { History: ["history", "historical", "war", "empire", "ancient", "president"], Politics: ["politics", "election", "government", "democracy"], Geography: ["geography", "map", "country", "city", "border"], Science: ["science", "physics", "biology", "chemistry", "evolution"], Nature: ["nature", "animal", "wildlife", "beast", "ocean", "extinct"], Mathematics: ["math", "number", "geometry", "calculus"], Literature: ["book", "poem", "literature", "novel", "writing"], Sports: ["sports", "baseball", "football", "basketball", "soccer"], Culture: ["culture", "music", "film", "art", "language"], Technology: ["technology", "computer", "internet", "software", "engineering"] };
    const result = Object.keys(rules).filter(function (topic) { return rules[topic].some(function (word) { return text.includes(word); }); });
    return result.length ? result : ["Culture"];
  }
  function parallel(items, limit, worker) {
    const results = new Array(items.length); let next = 0;
    async function run() { while (true) { const index = next++; if (index >= items.length) return; results[index] = await worker(items[index], index); } }
    return Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)).then(function () { return results; });
  }
  function sourceIdFor(seed) { return "individual:" + (seed[2] || norm(seed[1])); }
  function isAllowed(video) { return policy.isApprovedYouTubeVideo(video); }
  async function resolveChannel(seed, key) {
    let payload;
    if (seed[2]) payload = await request("channels", { part: "snippet,contentDetails", id: seed[2] }, key);
    else if (seed[1]) payload = await request("channels", { part: "snippet,contentDetails", forHandle: seed[1].replace(/^@/, "") }, key);
    else {
      const found = await request("search", { part: "snippet", q: seed[0], type: "channel", maxResults: "8" }, key);
      const match = (found.items || []).find(function (item) { return norm(item.snippet && item.snippet.title) === norm(seed[0]); });
      if (!match || !match.id || !match.id.channelId) throw new Error("Could not verify the approved channel “" + seed[0] + "”.");
      payload = await request("channels", { part: "snippet,contentDetails", id: match.id.channelId }, key);
    }
    const item = payload.items && payload.items[0];
    if (!item || !item.id || (seed[2] && item.id !== seed[2]) || ![seed[0]].concat(seed[4] || []).some(function(title){return norm(item.snippet && item.snippet.title) === norm(title);})) throw new Error("YouTube returned a different channel for “" + seed[0] + "”.");
    return { id: item.id, name: item.snippet.title || seed[0], handle: item.snippet.customUrl || seed[1], thumbnailUrl: item.snippet.thumbnails && item.snippet.thumbnails.default && item.snippet.thumbnails.default.url, uploadsPlaylistId: item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads, videoCount: 0, approved: true, sourceKind: seed[3] && seed[3].length ? "playlists" : "uploads", approvedPlaylistIds: seed[3] || [] };
  }
  function createMetadataLoader(key, assertCurrent) {
    // Share raw metadata, never source-specific approval decisions.
    const pending = new Map();
    return async function (ids) {
      assertCurrent();
      const uniqueIds = Array.from(new Set(ids));
      const missing = uniqueIds.filter(function (id) { return !pending.has(id); });
      for (let offset = 0; offset < missing.length; offset += 50) {
        const batch = missing.slice(offset, offset + 50);
        const response = request("videos", { part: "snippet,contentDetails,status", id: batch.join(",") }, key).then(function (payload) {
          if (!payload || !Array.isArray(payload.items)) throw new Error("YouTube returned invalid video metadata. The checkpoint was not advanced.");
          return new Map(payload.items.map(function (item) { return [item.id, item]; }));
        });
        batch.forEach(function (id) { pending.set(id, response.then(function (items) { return items.get(id); })); });
      }
      return (await Promise.all(uniqueIds.map(function (id) { return pending.get(id); }))).filter(Boolean);
    };
  }
  async function importPlaylist(channel, playlistId, sourceId, key, metadata, pages, committedAt, assertCurrent) {
    const checkpoints = window.LEARNED_MEDIA_YOUTUBE_CHECKPOINTS;
    const identity = checkpoints.importPageIdentity(policy.YOUTUBE_CATALOG_VERSION, channel.id, playlistId);
    let checkpoint = await checkpoints.openImportCheckpoint(pages, sourceId, identity, committedAt, assertCurrent), restarted = false;
    while (checkpoint.nextPageToken !== null) {
      assertCurrent();
      checkpoint.assertPageRequestAllowed();
      const pageToken = checkpoint.nextPageToken;
      let payload;
      try { payload = await request("playlistItems", Object.assign({ part: "snippet,contentDetails", playlistId: playlistId, maxResults: "50" }, pageToken ? { pageToken: pageToken } : {}), key); }
      catch (error) {
        if (pageToken && !restarted && /invalid.*page.*token|page.*token.*invalid/i.test(error.message || "")) {
          assertCurrent(); await pages.clear(sourceId); checkpoint = await checkpoints.openImportCheckpoint(pages, sourceId, identity, committedAt, assertCurrent); restarted = true; continue;
        }
        throw error;
      }
      if (!payload || !Array.isArray(payload.items) || payload.nextPageToken !== undefined && typeof payload.nextPageToken !== "string") throw new Error("YouTube returned an invalid import page. Its checkpoint was not advanced.");
      checkpoint.validateNextPageToken(payload.nextPageToken || null);
      const ids = payload.items.filter(function (item) { return !/#shorts?\b/i.test((item.snippet && item.snippet.title || "") + " " + (item.snippet && item.snippet.description || "")); }).map(function (item) { return item.contentDetails && item.contentDetails.videoId; }).filter(Boolean);
      const items = await metadata(ids);
      assertCurrent();
      await checkpoint.append(mapPlaylistPage(items, channel, sourceId).filter(isAllowed), payload.nextPageToken || null);
      await background.yieldBackground(assertCurrent);
    }
    return checkpoint.completedRefresh();
  }
  function mapPlaylistPage(items, channel, sourceId) {
    const videos = [];
    items.forEach(function (item) {
      if (!item.id || item.status && item.status.privacyStatus && item.status.privacyStatus !== "public" || item.snippet && item.snippet.channelId && item.snippet.channelId !== channel.id) return;
      const snippet = item.snippet || {}; const title = String(snippet.title || "").trim(); if (!title || !snippet.publishedAt) return;
      const seconds = duration(item.contentDetails && item.contentDetails.duration);
      if(policy.isYouTubeShortMetadata({title:title,description:snippet.description||"",tags:snippet.tags||[],publishedAt:snippet.publishedAt,durationSeconds:seconds,thumbnails:Object.values(snippet.thumbnails||{})}))return;
      videos.push({ id: item.id, channelId: channel.id, channelName: snippet.channelTitle || channel.name, title: title, description: snippet.description || "", tags: snippet.tags || [], publishedAt: snippet.publishedAt, durationSeconds: seconds, durationLabel: durationLabel(seconds), thumbnailUrl: snippet.thumbnails && ((snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default) || {}).url, embedAvailable: !(item.status && item.status.embeddable === false), topics: topics(channel.name, title, snippet.description || "", snippet.tags || []), approved: true, sourceIds: [sourceId], metadataRefreshedAt: new Date().toISOString() });
    });
    return videos;
  }
  async function importChannel(channel, key, metadata, pages, committedAt, assertCurrent) { if (!channel.uploadsPlaylistId) throw new Error("The approved channel “" + channel.name + "” has no uploads playlist."); return importPlaylist(channel, channel.uploadsPlaylistId, "channel:" + channel.id, key, metadata, pages, committedAt, assertCurrent); }
  async function resolveIndividual(seed, channels, key, metadata) {
    let id = seed[2];
    if (!id) {
      const channel = channels.find(function (item) { return norm(item.name) === norm(seed[0]); });
      const found = await request("search", Object.assign({ part: "snippet", q: seed[1], type: "video", maxResults: "10" }, channel ? { channelId: channel.id } : {}), key);
      const match = (found.items || []).find(function (item) { return norm(item.snippet && item.snippet.title) === norm(seed[1]) && norm(item.snippet && item.snippet.channelTitle) === norm(seed[0]); });
      id = match && match.id && match.id.videoId;
    }
    if (!id) throw new Error("Could not verify the approved video “" + seed[1] + "”.");
    const item = (await metadata([id]))[0];
    if (!item || norm(item.snippet && item.snippet.title) !== norm(seed[1]) || norm(item.snippet && item.snippet.channelTitle) !== norm(seed[0])) throw new Error("The approved video “" + seed[1] + "” did not match its title and creator.");
    const snippet = item.snippet; const seconds = duration(item.contentDetails && item.contentDetails.duration);
    return { id: item.id, channelId: snippet.channelId || "special-" + norm(seed[0]).replace(/ /g, "-"), channelName: snippet.channelTitle || seed[0], title: snippet.title, description: snippet.description || "", tags: snippet.tags || [], publishedAt: snippet.publishedAt || new Date().toISOString(), durationSeconds: seconds, durationLabel: durationLabel(seconds), thumbnailUrl: snippet.thumbnails && ((snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default) || {}).url, embedAvailable: !(item.status && item.status.embeddable === false), topics: topics(seed[0], snippet.title, snippet.description || "", snippet.tags || []), approved: true, special: true, sourceIds: [sourceIdFor(seed)], metadataRefreshedAt: new Date().toISOString() };
  }
  async function sync(key, existing, onProgress, force, isCurrent) {
    function assertCurrent() { if (isCurrent && !isCurrent()) throw new DOMException("YouTube import canceled.", "AbortError"); }
    const pages = {
      has: function (sourceId) { assertCurrent(); return window.__learnedMediaNativeRequest("hasYouTubeImportPages", { sourceId: sourceId }); },
      load: async function (sourceId) { const records = []; for await (const batch of pages.loadBatches(sourceId)) records.push.apply(records, batch); return records; },
      loadBatches: async function* (sourceId, cancellation) {
        const batchSize = window.LEARNED_MEDIA_YOUTUBE_CHECKPOINTS.YOUTUBE_IMPORT_PAGE_BATCH_SIZE;
        let offset = 0;
        while (true) {
          assertCurrent();
          background.checkBackgroundCancellation(cancellation);
          const batch = await window.__learnedMediaNativeRequest("loadYouTubeImportPageBatch", { sourceId: sourceId, offset: offset, limit: batchSize });
          assertCurrent();
          background.checkBackgroundCancellation(cancellation);
          if (!Array.isArray(batch)) throw new Error("The YouTube import checkpoint batch is invalid.");
          if (!batch.length) return;
          yield batch;
          offset += batch.length;
          await background.yieldBackground(assertCurrent);
        }
      },
      save: function (page) { assertCurrent(); return window.__learnedMediaNativeRequest("saveYouTubeImportPage", { page: page }); },
      clear: function (sourceId) { assertCurrent(); return window.__learnedMediaNativeRequest("clearYouTubeImportPages", { sourceId: sourceId }); }
    };
    const metadata = createMetadataLoader(key, assertCurrent);
    const workspace = existing || {}; const oldChannels = workspace.channels || []; const oldVideos = workspace.videos || []; const sourceStates = Object.assign({}, workspace.sourceStates || {}); const errors = []; const now = Date.now(); const day = 24 * 60 * 60 * 1000;
    const progress = { phase: "resolving", completedChannels: 0, totalChannels: CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 };
    onProgress(Object.assign({}, progress));
    const resolved = await parallel(CHANNELS, 4, async function (seed, index) {
      assertCurrent();
      const previous = oldChannels.find(function (channel) { return norm(channel.name) === norm(seed[0]); });
      try {
        const channel = previous && (!seed[2] || previous.id === seed[2]) ? Object.assign({}, previous, { sourceKind: seed[3] && seed[3].length ? "playlists" : "uploads", approvedPlaylistIds: seed[3] || [] }) : await resolveChannel(seed, key);
        assertCurrent();
        progress.completedChannels = index + 1; onProgress(Object.assign({}, progress)); return { seed: seed, channel: channel };
      } catch (error) {
        assertCurrent();
        progress.completedChannels = index + 1; errors.push(error.message || "Approved channel verification failed."); progress.error = errors.slice(0, 3).join(" · "); onProgress(Object.assign({}, progress)); return { seed: seed, channel: previous || null };
      }
    });
    const verified = resolved.filter(function (entry) { return Boolean(entry.channel); }); const jobs = [];
    verified.forEach(function (entry) { if (entry.seed[3] && entry.seed[3].length) entry.seed[3].forEach(function (playlistId) { jobs.push({ sourceId: "playlist:" + playlistId, label: entry.channel.name + " · approved playlist", kind: "playlist", channel: entry.channel, playlistId: playlistId }); }); else jobs.push({ sourceId: "channel:" + entry.channel.id, label: entry.channel.name, kind: "uploads", channel: entry.channel }); });
    INDIVIDUALS.forEach(function (seed) { jobs.push({ sourceId: sourceIdFor(seed), label: seed[1], kind: "individual", seed: seed }); });
    progress.totalSources = jobs.length; progress.phase = "importing"; onProgress(Object.assign({}, progress));
    const imported = await parallel(jobs, 4, async function (job) {
      assertCurrent();
      progress.currentSource = job.label; const prior = sourceStates[job.sourceId]; const due = Boolean(force || !prior || prior.status === "error" || !prior.lastSuccessfulSyncAt || now - new Date(prior.lastSuccessfulSyncAt).getTime() >= day || await pages.has(job.sourceId));
      assertCurrent();
      if (!due) { progress.completedSources += 1; onProgress(Object.assign({}, progress)); return { job: job, videos: [], refresh: undefined, scanned: false, ok: true }; }
      try {
        let refresh;
        const committedAt = prior && prior.lastSuccessfulSyncAt;
        if (job.kind === "uploads") refresh = await importChannel(job.channel, key, metadata, pages, committedAt, assertCurrent);
        else if (job.kind === "playlist") refresh = await importPlaylist(job.channel, job.playlistId, job.sourceId, key, metadata, pages, committedAt, assertCurrent);
        else {
          const checkpoints = window.LEARNED_MEDIA_YOUTUBE_CHECKPOINTS;
          const checkpoint = await checkpoints.openImportCheckpoint(pages, job.sourceId, checkpoints.importPageIdentity(policy.YOUTUBE_CATALOG_VERSION, job.seed[0], job.seed[2] || job.seed[1]), committedAt, assertCurrent);
          if (checkpoint.nextPageToken !== null) {
            const video = await resolveIndividual(job.seed, verified.map(function (entry) { return entry.channel; }), key, metadata);
            assertCurrent(); await checkpoint.append(isAllowed(video) ? [video] : [], null);
          }
          refresh = checkpoint.completedRefresh();
        }
        assertCurrent();
        if (refresh.sourceId !== job.sourceId || !refresh.complete) throw new Error("The YouTube refresh is incomplete.");
        const videos = refresh.videos;
        progress.importedVideos += videos.length; progress.completedSources += 1; sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "ready", refreshGeneration: refresh.generation, lastSuccessfulSyncAt: new Date().toISOString(), lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: videos.length }; onProgress(Object.assign({}, progress)); return { job: job, videos: videos, refresh: refresh, scanned: true, ok: true };
      } catch (error) {
        assertCurrent();
        const message = error.message || "Approved source import failed."; errors.push(message); progress.error = errors.slice(0, 3).join(" · "); progress.completedSources += 1; sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "error", refreshGeneration: prior && prior.refreshGeneration, lastSuccessfulSyncAt: prior && prior.lastSuccessfulSyncAt, lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: prior && prior.importedVideoCount, error: message }; onProgress(Object.assign({}, progress)); return { job: job, videos: [], refresh: undefined, scanned: false, ok: false };
      }
    });
    assertCurrent();
    const allowed = await window.LEARNED_MEDIA_VIDEO_SOURCES.mergeVideoSourceRefreshes(oldVideos,
      imported.filter(function (result) { return result.scanned && result.ok; }).map(function (result) { return result.refresh; }), isAllowed, undefined, assertCurrent);
    const channelCounts = new Map();
    const videos = await window.LEARNED_MEDIA_VIDEO_SOURCES.reuseIndexedVideoRecords(oldVideos, allowed, assertCurrent);
    await background.forEachBackground(videos, function (video) { channelCounts.set(video.channelId, (channelCounts.get(video.channelId) || 0) + 1); }, assertCurrent);
    const channels = verified.map(function (entry) { return Object.assign({}, entry.channel, { videoCount: channelCounts.get(entry.channel.id) || 0, lastImportedAt: new Date().toISOString() }); });
    const complete = errors.length === 0 && verified.length === CHANNELS.length; progress.phase = "complete"; progress.currentSource = undefined; progress.error = complete ? undefined : (progress.error || "Some approved video sources need a retry."); onProgress(Object.assign({}, progress));
    return { channels: channels, videos: videos, sourceStates: sourceStates, incomplete: !complete, progress: progress, lastSyncAt: new Date().toISOString(), completedRefreshes: imported.filter(function (result) { return result.scanned && result.ok; }).map(function (result) { return { sourceId: result.refresh.sourceId, generation: result.refresh.generation, identity: result.refresh.identity }; }), completedCheckpointSources: imported.filter(function (result) { return result.scanned && result.ok; }).map(function (result) { return result.job.sourceId; }) };
  }
  function filter(videos, query, topic, channelId) {
    const term = norm(query); return (videos || []).filter(function (video) { if (!isAllowed(video)) return false; if (channelId && video.channelId !== channelId) return false; if (topic && topic !== "All" && !(video.topics || []).includes(topic)) return false; if (!term) return true; const fields = [{ name: "title", value: video.title }, { name: "description", value: video.description }, { name: "tags", value: (video.tags || []).join(" ") }, { name: "topics", value: (video.topics || []).join(" ") }]; const words = term.split(" ").filter(function (word) { return word.length > 1; }); return words.every(function (word) { return fields.some(function (field) { const value = norm(field.value); return value.indexOf(word) >= 0 || value.split(" ").some(function (candidate) { return word.length >= 5 && candidate.length >= 5 && distance(word, candidate) <= (word.length >= 8 ? 2 : 1); }); }); }); });
  }
  function cleanDescription(value) { return String(value || "").replace(/(?:subscribe|like and subscribe|follow us|social media|patreon|sponsor(?:ed)? by|use code|affiliate|merch(?:andise)?|join the discord|business inquiries|check out my|support the channel)[^.!?]*(?:[.!?]|$)/gi, " ").replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim().slice(0, 1800); }
  function distance(left, right) {
    if (left === right) return 0;
    const rows = Array.from({ length: right.length + 1 }, function (_, index) { return index; });
    for (let row = 1; row <= left.length; row += 1) { let diagonal = rows[0]; rows[0] = row; for (let column = 1; column <= right.length; column += 1) { const above = rows[column]; rows[column] = Math.min(rows[column] + 1, rows[column - 1] + 1, diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)); diagonal = above; } }
    return rows[right.length];
  }
  function termMatches(term, fields) {
    const wanted = norm(term); if (!wanted) return { matched: false, score: 0, fields: [], support: [] };
    const wantedWords = wanted.split(" ").filter(function (word) { return word.length > 1; }); let score = 0; const matchedFields = []; const support = [];
    fields.forEach(function (field) { const value = norm(field.value); const words = value.split(" ").filter(Boolean); const phrase = value.indexOf(wanted) >= 0; const matched = wantedWords.filter(function (word) { return words.some(function (candidate) { return candidate === word || word.length >= 5 && candidate.length >= 5 && distance(word, candidate) <= (word.length >= 8 ? 2 : 1); }); }); if (!phrase && (!matched.length || matched.length < Math.max(1, Math.ceil(wantedWords.length * .5)))) return; const multiplier = field.name === "title" ? 8 : field.name === "tags" ? 4 : field.name === "topics" ? 3 : field.name === "description" ? 2 : 1; score += multiplier * (phrase ? 2 : matched.length / Math.max(wantedWords.length, 1)); matchedFields.push(field.name); if (field.name === "title" || field.name === "description") support.push(field.value.slice(0, 220)); });
    return { matched: score > 0, score: score, fields: Array.from(new Set(matchedFields)), support: Array.from(new Set(support)).slice(0, 3) };
  }
  function broadTokenScore(term, fields) {
    const wanted = norm(term).split(" ").filter(function (word) { return word.length > 2; });
    if (!wanted.length) return 0;
    const searchableWords = norm(fields.map(function (field) { return field.value; }).join(" ")).split(" ").filter(Boolean);
    const matched = wanted.filter(function (word) { return searchableWords.some(function (candidate) { return candidate === word || word.length >= 5 && candidate.length >= 5 && distance(word, candidate) <= (word.length >= 8 ? 2 : 1); }); });
    return matched.length / wanted.length;
  }
  function searchCandidates(videos, plan, topic, channelId, limit, excludedIds) { return window.LEARNED_MEDIA_VIDEO_SEARCH.searchSemanticVideos(videos, plan, topic, channelId, limit || 80, excludedIds || []); }
  function shuffle(videos, count, exclude, preferences) {
    return policy.selectRandomVideos((videos || []).filter(isAllowed),count,exclude || [],preferences || DEFAULT_RECENCY_PREFERENCES);
  }
  window.LEARNED_MEDIA_YOUTUBE = { CHANNELS: CHANNELS, TOPICS: TOPICS, DEFAULT_RECENCY_PREFERENCES: DEFAULT_RECENCY_PREFERENCES, sync: sync, filter: filter, searchCandidates: searchCandidates, shuffle: shuffle };
})();
