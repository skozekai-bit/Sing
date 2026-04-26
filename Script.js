const ac = new (window.AudioContext || window.webkitAudioContext)();
const masterFilter = ac.createBiquadFilter();
const distortion = ac.createWaveShaper();
masterFilter.type = "lowpass";
distortion.connect(masterFilter);
masterFilter.connect(ac.destination);

// 1. DATA CACHE
const gearDB = {
    'nirvana': { type: 'BAND', dist: 45, filter: 7500, label: "DS-1 Grunge Sync" },
    'metallica': { type: 'BAND', dist: 90, filter: 8500, label: "Thrash Engine" },
    'sheeran': { type: 'SOLO', dist: 2, filter: 3500, label: "Solo Acoustic Hall" },
    'adele': { type: 'SOLO', dist: 0, filter: 2500, label: "Grand Piano Hall" }
};

// 2. STATE
let instrument = null;
let currentPattern = "D D U U D";
let bpm = 120;
let isStrumming = false;
let patternInterval;
let activeMidi = 48;
let activeChordType = 'maj';

const chords = { maj: [0, 4, 7, 12], min: [0, 3, 7, 12], dom7: [0, 4, 7, 10] };

// 3. LOGIC
function smartSync() {
    const query = document.getElementById('artistInput').value.toLowerCase();
    const typeLabel = document.getElementById('syncType');
    const display = document.getElementById('dataStream');

    for (let key in gearDB) {
        if (query.includes(key)) {
            const match = gearDB[key];
            typeLabel.innerText = `● ${match.type} SYNCED`;
            typeLabel.style.color = match.type === 'BAND' ? '#ff4444' : '#00f2ff';
            display.innerText = match.label;
            applyDSP(match.dist, match.filter);
            return;
        }
    }
}

function applyDSP(dist, freq) {
    masterFilter.frequency.setTargetAtTime(freq, ac.currentTime, 0.1);
    const n = 44100; const curve = new Float32Array(n);
    for (let i = 0; i < n; ++i) {
        let x = i * 2 / n - 1;
        curve[i] = (3 + dist) * x * 20 * (Math.PI / 180) / (Math.PI + dist * Math.abs(x));
    }
    distortion.curve = curve;
}

function playStrum() {
    if (!instrument || isStrumming) return;
    isStrumming = true;
    const pattern = currentPattern.split(" ");
    let step = 0;
    const stepTime = (60 / bpm) / 2; // 8th notes

    patternInterval = setInterval(() => {
        const stroke = pattern[step % pattern.length].toUpperCase();
        const ticks = document.querySelectorAll('.tick');
        ticks.forEach((t, i) => t.classList.toggle('active', i === (step % pattern.length)));

        if (stroke !== "X") {
            const intervals = stroke === "U" ? [...chords[activeChordType]].reverse() : chords[activeChordType];
            intervals.forEach((interval, i) => {
                const delay = i * 0.03;
                instrument.play(activeMidi + interval, ac.currentTime + delay, { 
                    gain: stroke === "U" ? 0.4 : 0.7, 
                    duration: 1.5 
                }).connect(distortion);
            });
        }
        step++;
    }, stepTime * 1000);
}

function stopStrum() {
    clearInterval(patternInterval);
    isStrumming = false;
    document.querySelectorAll('.tick').forEach(t => t.classList.remove('active'));
}

// UI HANDLERS
function updateBPM(v) { bpm = v; document.getElementById('bpmVal').innerText = v; }
function updatePattern(v) { currentPattern = v; }

// PIANO RENDER
const piano = document.getElementById('piano');
const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let i = 0; i < 24; i++) {
    const name = notes[i % 12];
    const key = document.createElement('div');
    key.className = `key ${name.includes('#') ? 'black' : ''}`;
    key.innerHTML = name;
    key.onmousedown = () => { if(ac.state==='suspended') ac.resume(); activeMidi = i + 48; playStrum(); key.classList.add('playing'); };
    key.onmouseup = () => { stopStrum(); key.classList.remove('playing'); };
    key.onmouseleave = () => { stopStrum(); key.classList.remove('playing'); };
    piano.appendChild(key);
}

async function initAudio() {
    const name = document.getElementById('instSelect').value;
    instrument = await Soundfont.instrument(ac, name);
}
initAudio();

