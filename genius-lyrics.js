// Genius API Lyrics Management
let geniusClientId = null;
let geniusClientSecret = null;
let geniusAccessToken = null;

// Initialize Genius configuration
function initGenius() {
  geniusClientId = localStorage.getItem('hymne_genius_client_id');
  geniusClientSecret = localStorage.getItem('hymne_genius_client_secret');
  geniusAccessToken = localStorage.getItem('hymne_genius_access_token');
}

// Save Genius configuration
function saveGeniusConfig(clientId, clientSecret) {
  geniusClientId = clientId;
  geniusClientSecret = clientSecret;
  localStorage.setItem('hymne_genius_client_id', clientId);
  localStorage.setItem('hymne_genius_client_secret', clientSecret);
  return true;
}

// Get Genius client token
async function getGeniusClientToken() {
  if (!geniusClientId || !geniusClientSecret) {
    showGeniusConfigDialog();
    throw new Error('Genius client credentials not configured');
  }
  
  const response = await fetch('https://api.genius.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: geniusClientId,
      client_secret: geniusClientSecret,
      grant_type: 'client_credentials'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to get Genius client token');
  }
  
  const data = await response.json();
  geniusAccessToken = 'Bearer ' + data.access_token;
  localStorage.setItem('hymne_genius_access_token', geniusAccessToken);
  return geniusAccessToken;
}

// Search for songs on Genius
async function searchGenius(query) {
  if (!geniusAccessToken) {
    await getGeniusClientToken();
  }
  
  const token = geniusAccessToken.replace('Bearer ', '');
  const response = await fetch('https://api.genius.com/search?q=' + encodeURIComponent(query) + '&access_token=' + encodeURIComponent(token));
  
  if (!response.ok) {
    throw new Error('Genius search failed: ' + response.status);
  }
  
  const data = await response.json();
  return data.response.hits.map(hit => hit.result);
}

// Get lyrics for a specific song
async function getGeniusLyrics(songId) {
  if (!geniusAccessToken) {
    await getGeniusClientToken();
  }
  
  const token = geniusAccessToken.replace('Bearer ', '');
  const response = await fetch('https://api.genius.com/songs/' + songId + '?access_token=' + encodeURIComponent(token));
  
  if (!response.ok) {
    throw new Error('Failed to fetch Genius lyrics: ' + response.status);
  }
  
  const data = await response.json();
  const song = data.response.song;
  
  // Use the path field to construct the correct Genius URL
  const lyricsUrl = 'https://genius.com' + song.path;
  console.log('Fetching lyrics from:', lyricsUrl);
  
  // Fetch the Genius page directly
  const pageResponse = await fetch(lyricsUrl);
  if (!pageResponse.ok) {
    throw new Error('Failed to fetch Genius page: ' + pageResponse.status);
  }
  
  const html = await pageResponse.text();
  console.log('HTML length:', html.length);
  const lyrics = extractLyricsFromHTML(html);
  console.log('Extracted lyrics length:', lyrics ? lyrics.length : 0);
  
  return {
    lyrics: lyrics,
    language: song.language || null,
    title: song.title,
    artist: song.primary_artist?.name,
    url: song.url
  };
}

// Extract lyrics from Genius HTML page
function extractLyricsFromHTML(html) {
  // Try simple lyrics div first
  let lyrics = html.match(/<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/);
  if (lyrics) {
    lyrics = lyrics[1];
    lyrics = lyrics.replace(/<br\s*\/?>/gi, '\n');
    lyrics = lyrics.replace(/<[^>]*>/g, '');
    lyrics = lyrics.replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&#x27;/g, "'")
                   .replace(/&apos;/g, "'");
    lyrics = lyrics.replace(/\n\s*\n/g, '\n\n').trim();
    if (lyrics.length > 50) return lyrics;
  }
  
  // If no lyrics found, try Lyrics__Container
  lyrics = '';
  // Use DOM to parse entire HTML document
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  // Find all Lyrics__Container elements
  const containers = tempDiv.querySelectorAll('[class*="Lyrics__Container"]');
  
  for (let i = 0; i < containers.length; i++) {
    const container = containers[i];
    // Clone container and remove nested metadata elements
    const containerClone = container.cloneNode(true);
    
    // Remove metadata elements from the cloned container
    const metadataElements = containerClone.querySelectorAll('[class*="ContributorsCreditSong"], [class*="LyricsHeader"], [class*="Contributors"], [class*="SongPageHeader"]');
    metadataElements.forEach(el => el.remove());
    
    // Convert br tags to newlines before extracting text
    const brElements = containerClone.querySelectorAll('br');
    brElements.forEach(br => br.replaceWith('\n'));
    
    let textContent = containerClone.textContent || containerClone.innerText || '';
    textContent = textContent.trim();
    if (textContent.length !== 0) {
      lyrics += textContent + '\n\n';
    }
  }
  
  if (!lyrics) return null;
  return lyrics.trim();
}

// Show Genius configuration dialog
function showGeniusConfigDialog() {
  const dialog = document.createElement('div');
  dialog.id = 'geniusConfigDialog';
  dialog.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:30px;max-width:500px;width:90%">
        <h2 style="color:var(--text);margin-bottom:20px">Genius API Configuration</h2>
        <p style="color:var(--sub);margin-bottom:20px;line-height:1.6">
          To fetch lyrics from Genius, you need API credentials:
        </p>
        <div style="margin-bottom:20px">
          <div style="margin-bottom:10px">
            <label style="display:block;color:var(--text);margin-bottom:5px">1. Create a Genius API app:</label>
            <a href="https://genius.com/api-clients" target="_blank" style="color:var(--accent)">https://genius.com/api-clients</a>
          </div>
          <div style="margin-bottom:10px">
            <label style="display:block;color:var(--text);margin-bottom:5px">2. Copy your Client ID:</label>
            <input type="text" id="geniusClientIdInput" placeholder="Genius Client ID" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px">
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;color:var(--text);margin-bottom:5px">3. Copy your Client Secret:</label>
            <input type="password" id="geniusClientSecretInput" placeholder="Genius Client Secret" style="width:100%;padding:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px">
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button id="saveGeniusBtn" style="flex:1;padding:10px;background:var(--accent);color:#020c05;border:none;border-radius:4px;cursor:pointer">Save</button>
          <button id="cancelGeniusBtn" style="flex:1;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Pre-fill saved values
  const savedId = localStorage.getItem('hymne_genius_client_id');
  const savedSecret = localStorage.getItem('hymne_genius_client_secret');
  if (savedId) document.getElementById('geniusClientIdInput').value = savedId;
  if (savedSecret) document.getElementById('geniusClientSecretInput').value = savedSecret;
  
  // Event listeners
  document.getElementById('saveGeniusBtn').onclick = () => {
    const clientId = document.getElementById('geniusClientIdInput').value.trim();
    const clientSecret = document.getElementById('geniusClientSecretInput').value.trim();
    
    if (!clientId || !clientSecret) {
      alert('Both Client ID and Secret are required');
      return;
    }
    
    saveGeniusConfig(clientId, clientSecret);
    document.body.removeChild(dialog);
    toast('Genius configuration saved!', true);
  };
  
  document.getElementById('cancelGeniusBtn').onclick = () => {
    document.body.removeChild(dialog);
  };
}

// Main fetchLyrics function
async function fetchLyrics(trackName, artistName) {
  try {
    console.log('Fetching lyrics from Genius for:', trackName, 'by', artistName);
    
    // Search for the song
    const results = await searchGenius(trackName + ' ' + artistName);
    
    if (!results.length) {
      throw new Error('No results found on Genius');
    }
    
    // Find best match
    let bestResult = null;
    let bestScore = 0;
    
    for (const result of results) {
      const titleMatch = result.title.toLowerCase().includes(trackName.toLowerCase()) || 
                       trackName.toLowerCase().includes(result.title.toLowerCase());
      const artistMatch = result.primary_artist.name.toLowerCase().includes(artistName.toLowerCase()) || 
                        artistName.toLowerCase().includes(result.primary_artist.name.toLowerCase());
      
      const score = (titleMatch ? 2 : 0) + (artistMatch ? 2 : 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }
    
    if (!bestResult || bestScore < 2) {
      throw new Error('No good match found on Genius');
    }
    
    // Get lyrics for the best match
    const lyricsData = await getGeniusLyrics(bestResult.id);
    console.log(lyricsData);
    
    if (!lyricsData || !lyricsData.lyrics) {
      throw new Error('No lyrics available for this song on Genius');
    }
    
    return {
      lyrics: lyricsData.lyrics,
      language: lyricsData.language,
      title: lyricsData.title,
      artist: lyricsData.artist
    };
    
  } catch (error) {
    console.error('Lyrics fetch error:', error);
    throw error;
  }
}

// Export functions
window.GeniusLyrics = {
  init: initGenius,
  saveConfig: saveGeniusConfig,
  fetch: fetchLyrics,
};
