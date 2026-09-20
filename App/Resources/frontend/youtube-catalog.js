(function () {
  "use strict";

  const CHANNELS = [
    ["History Matters"], ["Election History"], ["Secret Base"], ["Geo History"], ["Great Books Explained"], ["BooneU"], ["Joon Lee"], ["TLDR News Global"], ["Mr. Beat"], ["The Generalist Papers"], ["CGP Grey", "@CGPGrey"], ["Power Politics"], ["Half as Interesting"], ["Hoser"], ["The History Guy: History Deserves to Be Remembered"], ["History Buffs Hub"], ["Ceramic", "@ceramic01"], ["Reading Through History"], ["Atlas Pro"], ["African Biographics"], ["Phil Edwards"], ["Tor’s Cabinet of Curiosities"], ["Extra History"], ["Justin Portela"], ["Patrick Kelly"], ["Historically"], ["Mental Floss"], ["Crash Course"], ["SciShow"], ["OverSimplified"], ["vlogbrothers"], ["Sam O’Nella Academy"], ["3Blue1Brown"], ["Shawn Grows"], ["General Knowledge"], ["Jay Hona"], ["Veritasium"], ["theweeklyjack", "@theweeklyjack1"], ["Jackdaw"], ["Grist"], ["Bizarre Beasts"], ["Ze Frank"], ["Make Thing With Hand"], ["Be Smart"], ["PBS Eons"], ["Deep Look"], ["MinuteEarth"], ["minutephysics"], ["Brailor"], ["hydn"], ["ExtinctZoo", "@ExtinctZoo"]
  ];
  const INDIVIDUALS = [
    ["melodysheep", "TIMELAPSE OF THE ENTIRE UNIVERSE", "TBikbn5XJhg"],
    ["Ollie Bye", "The History of the World: Every Year", "-6Wu0Q7x5D0"],
    ["Ollie Bye", "Top 5 Tallest Buildings Throughout History", ""],
    ["Ollie Bye", "The Largest Cities Throughout History: Every Year", ""],
    ["Ollie Bye", "The Spread of Writing: Every Year", "eUpJ4yVCNrI"],
    ["American Museum of Natural History", "Human Population Through Time (Updated in 2023)", ""]
  ];
  const TOPICS = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"];

  function request(resource, params, key) {
    return window.__learnedMediaNativeRequest("youtubeRequest", { resource: resource, params: params, key: key });
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
  async function resolveChannel(seed, key) {
    let payload;
    if (seed[1]) payload = await request("channels", { part: "snippet,contentDetails", forHandle: seed[1].replace(/^@/, "") }, key);
    else {
      const found = await request("search", { part: "snippet", q: seed[0], type: "channel", maxResults: "8" }, key);
      const match = (found.items || []).find(function (item) { return norm(item.snippet && item.snippet.title) === norm(seed[0]); });
      if (!match || !match.id || !match.id.channelId) throw new Error("Could not verify the approved channel “" + seed[0] + "”.");
      payload = await request("channels", { part: "snippet,contentDetails", id: match.id.channelId }, key);
    }
    const item = payload.items && payload.items[0];
    if (!item || !item.id || norm(item.snippet && item.snippet.title) !== norm(seed[0])) throw new Error("YouTube returned a different channel for “" + seed[0] + "”.");
    return { id: item.id, name: item.snippet.title || seed[0], handle: item.snippet.customUrl || seed[1], thumbnailUrl: item.snippet.thumbnails && item.snippet.thumbnails.default && item.snippet.thumbnails.default.url, uploadsPlaylistId: item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads, videoCount: 0, approved: true };
  }
  async function importChannel(channel, key, onCount) {
    if (!channel.uploadsPlaylistId) throw new Error("The approved channel “" + channel.name + "” has no uploads playlist.");
    const ids = []; let pageToken = "";
    do {
      const payload = await request("playlistItems", Object.assign({ part: "snippet,contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: "50" }, pageToken ? { pageToken: pageToken } : {}), key);
      (payload.items || []).forEach(function (item) { if (item.contentDetails && item.contentDetails.videoId) ids.push(item.contentDetails.videoId); });
      onCount(ids.length);
      pageToken = payload.nextPageToken || "";
    } while (pageToken);
    const batches = await parallel(Array.from({ length: Math.ceil(ids.length / 50) }, function (_, index) { return ids.slice(index * 50, index * 50 + 50); }), 4, function (batch) { return request("videos", { part: "snippet,contentDetails,status", id: batch.join(",") }, key); });
    const videos = [];
    batches.forEach(function (payload) { (payload.items || []).forEach(function (item) {
      if (!item.id || item.status && item.status.privacyStatus && item.status.privacyStatus !== "public") return;
      const snippet = item.snippet || {}; const title = String(snippet.title || "").trim(); if (!title || !snippet.publishedAt) return;
      const seconds = duration(item.contentDetails && item.contentDetails.duration);
      videos.push({ id: item.id, channelId: channel.id, channelName: snippet.channelTitle || channel.name, title: title, description: snippet.description || "", tags: snippet.tags || [], publishedAt: snippet.publishedAt, durationSeconds: seconds, durationLabel: durationLabel(seconds), thumbnailUrl: snippet.thumbnails && ((snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default) || {}).url, embedAvailable: !(item.status && item.status.embeddable === false), topics: topics(channel.name, title, snippet.description || "", snippet.tags || []), approved: true });
    }); });
    return { channel: Object.assign({}, channel, { videoCount: videos.length, lastImportedAt: new Date().toISOString() }), videos: videos };
  }
  async function resolveIndividual(seed, channels, key) {
    let id = seed[2];
    if (!id) {
      const channel = channels.find(function (item) { return norm(item.name) === norm(seed[0]); });
      const found = await request("search", Object.assign({ part: "snippet", q: seed[1], type: "video", maxResults: "10" }, channel ? { channelId: channel.id } : {}), key);
      const match = (found.items || []).find(function (item) { return norm(item.snippet && item.snippet.title) === norm(seed[1]) && norm(item.snippet && item.snippet.channelTitle) === norm(seed[0]); });
      id = match && match.id && match.id.videoId;
    }
    if (!id) throw new Error("Could not verify the approved video “" + seed[1] + "”.");
    const payload = await request("videos", { part: "snippet,contentDetails,status", id: id }, key); const item = payload.items && payload.items[0];
    if (!item || norm(item.snippet && item.snippet.title) !== norm(seed[1]) || norm(item.snippet && item.snippet.channelTitle) !== norm(seed[0])) throw new Error("The approved video “" + seed[1] + "” did not match its title and creator.");
    const snippet = item.snippet; const seconds = duration(item.contentDetails && item.contentDetails.duration);
    return { id: item.id, channelId: snippet.channelId || "special-" + norm(seed[0]).replace(/ /g, "-"), channelName: snippet.channelTitle || seed[0], title: snippet.title, description: snippet.description || "", tags: snippet.tags || [], publishedAt: snippet.publishedAt || new Date().toISOString(), durationSeconds: seconds, durationLabel: durationLabel(seconds), thumbnailUrl: snippet.thumbnails && ((snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default) || {}).url, embedAvailable: !(item.status && item.status.embeddable === false), topics: topics(seed[0], snippet.title, snippet.description || "", snippet.tags || []), approved: true, special: true };
  }
  async function sync(key, existing, onProgress) {
    const progress = { phase: "resolving", completedChannels: 0, totalChannels: CHANNELS.length, importedVideos: 0 };
    onProgress(Object.assign({}, progress));
    const resolved = await parallel(CHANNELS, 4, async function (seed, index) {
      try { const previous = (existing || []).find(function (channel) { return norm(channel.name) === norm(seed[0]); }); const channel = previous || await resolveChannel(seed, key); progress.completedChannels = index + 1; onProgress(Object.assign({}, progress)); return channel; }
      catch (error) { progress.completedChannels = index + 1; progress.error = error.message || "Approved channel verification failed."; onProgress(Object.assign({}, progress)); return null; }
    });
    const channels = resolved.filter(Boolean); progress.phase = "importing"; progress.error = undefined; onProgress(Object.assign({}, progress));
    const imported = await parallel(channels, 4, async function (channel) { try { const result = await importChannel(channel, key, function () {}); progress.importedVideos += result.videos.length; onProgress(Object.assign({}, progress)); return result; } catch (error) { progress.error = error.message || "Channel import failed."; onProgress(Object.assign({}, progress)); return { channel: channel, videos: [] }; } });
    const special = await parallel(INDIVIDUALS, 4, async function (seed) { try { return await resolveIndividual(seed, imported.map(function (item) { return item.channel; }), key); } catch (_) { return null; } });
    const byId = {}; imported.forEach(function (item) { item.videos.forEach(function (video) { byId[video.id] = video; }); }); special.filter(Boolean).forEach(function (video) { byId[video.id] = video; });
    progress.phase = "complete"; progress.error = channels.length < CHANNELS.length ? "Some approved channels could not be verified. Retry to finish the library." : undefined; onProgress(Object.assign({}, progress));
    return { channels: imported.map(function (item) { return item.channel; }), videos: Object.keys(byId).map(function (id) { return byId[id]; }), incomplete: channels.length < CHANNELS.length, progress: progress };
  }
  function filter(videos, query, topic, channelId) {
    const term = norm(query); return (videos || []).filter(function (video) { if (channelId && video.channelId !== channelId) return false; if (topic && topic !== "All" && !(video.topics || []).includes(topic)) return false; if (!term) return true; return norm([video.title, video.description, video.channelName].concat(video.tags || [], video.topics || []).join(" ")).split(" ").filter(function (word) { return word.length > 1; }).every(function (word) { return norm([video.title, video.description, video.channelName].concat(video.tags || [], video.topics || []).join(" ")).includes(word); }); });
  }
  function shuffle(videos, count, exclude) {
    const skip = {}; (exclude || []).forEach(function (id) { skip[id] = true; }); const groups = {}; (videos || []).forEach(function (video) { if (!skip[video.id]) (groups[video.channelId] = groups[video.channelId] || []).push(video); }); const list = Object.keys(groups).map(function (key) { const group = groups[key].slice(); group.sort(function () { return Math.random() - .5; }); return group; }).sort(function () { return Math.random() - .5; }); const result = [];
    while (result.length < count && list.length) { let added = false; list.forEach(function (group) { if (result.length < count && group.length) { result.push(group.shift()); added = true; } }); if (!added) break; }
    return result;
  }
  window.LEARNED_MEDIA_YOUTUBE = { CHANNELS: CHANNELS, TOPICS: TOPICS, sync: sync, filter: filter, shuffle: shuffle };
})();
