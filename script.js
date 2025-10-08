const processes = [];
let currentTime = 0;
let queue = [];
let animationFrame;

const canvas = document.getElementById('ganttChart');
const ctx = canvas.getContext('2d');
const labelContainer = document.getElementById('ganttChart-labels');
const detailsTable = document.getElementById('detailsTable');
const timeline = document.getElementById('timeline');

// Map process name to color to maintain consistent colors
const processColors = {};
const availableColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFB347', '#6A5ACD', '#00CED1'];

function getProcessColor(name) {
  if (!processColors[name]) {
    const color = availableColors.shift() || getRandomColor();
    processColors[name] = color;
  }
  return processColors[name];
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Add a process
function addProcess() {
  const name = document.getElementById('processName').value;
  const arrival = parseInt(document.getElementById('arrivalTime').value);
  const burst = parseInt(document.getElementById('burstTime').value);
  const algorithm = document.getElementById('algorithm').value;
  
  const priority = ['priorityPreemptive', 'priorityNonPreemptive'].includes(algorithm)
    ? parseInt(document.getElementById('priority').value) || 0
    : undefined;

  if (!name || isNaN(arrival) || isNaN(burst)) {
    alert('Please fill all required fields!');
    return;
  }

  if (['priorityPreemptive', 'priorityNonPreemptive'].includes(algorithm) && 
      (isNaN(priority) || priority === undefined)) {
    alert('Please enter a valid priority for priority algorithms!');
    return;
  }

  processes.push({
    name,
    arrival,
    burst,
    remaining: burst,
    priority,
    completion: 0,
    turnaround: 0,
    waiting: 0
  });

  updateQueueDisplay();
  updateDetailsTable();
  clearInputs();
}

function clearInputs() {
  document.getElementById('processName').value = '';
  document.getElementById('arrivalTime').value = '';
  document.getElementById('burstTime').value = '';
  
  const algorithm = document.getElementById('algorithm').value;
  if (['priorityPreemptive', 'priorityNonPreemptive'].includes(algorithm)) {
    document.getElementById('priority').value = '';
  }
  if (algorithm === 'roundRobin') {
    document.getElementById('timeQuantum').value = '';
  }
}

// Update queue display
function updateQueueDisplay() {
  const queueContainer = document.getElementById('queue');
  queueContainer.innerHTML = '';
  processes.forEach(p => {
    const element = document.createElement('div');
    element.classList.add('queue-item');
    element.innerText = `${p.name} (${p.burst})`;
    if (p.priority !== undefined) {
      element.innerText += ` [P:${p.priority}]`;
    }
    queueContainer.appendChild(element);
  });
}

// Update process details table
function updateDetailsTable() {
  detailsTable.innerHTML = '';
  const algorithm = document.getElementById('algorithm').value;
  const showPriority = ['priorityPreemptive', 'priorityNonPreemptive'].includes(algorithm);
  
  processes.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.name}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      ${showPriority ? `<td>${p.priority}</td>` : '<td></td>'}
    `;
    detailsTable.appendChild(row);
  });
}

// Start scheduling
function startScheduling() {
  if (processes.length === 0) {
    alert('Please add at least one process!');
    return;
  }

  cancelAnimationFrame(animationFrame);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  timeline.innerHTML = ''; 
  currentTime = 0;
  document.getElementById('timer').innerText = 'Current Time: 0';
  document.getElementById('output').innerHTML = '';
  availableColors.push(...Object.values(processColors));
  Object.keys(processColors).forEach(key => delete processColors[key]);

  processes.forEach(p => {
    p.remaining = p.burst;
    p.completion = 0;
    p.turnaround = 0;
    p.waiting = 0;
  });

  const algorithm = document.getElementById('algorithm').value;
  if (algorithm === 'fcfs') {
    fcfs();
  } else if (algorithm === 'roundRobin') {
    roundRobin();
  } else if (algorithm === 'sjf') {
    sjf();
  } else if (algorithm === 'srtf') {
    srtf();
  } else if (algorithm === 'priorityPreemptive') {
    priorityPreemptive();
  } else if (algorithm === 'priorityNonPreemptive') {
    priorityNonPreemptive();
  }
}

// Algorithms
function fcfs() {
  queue = [...processes].sort((a, b) => a.arrival - b.arrival);
  animateProcesses();
}

function roundRobin() {
  const timeQuantum = parseInt(document.getElementById('timeQuantum').value) || 2;
  if (isNaN(timeQuantum) || timeQuantum <= 0) {
    alert('Please enter a valid time quantum!');
    return;
  }
  queue = [...processes].sort((a, b) => a.arrival - b.arrival);
  animateProcesses(timeQuantum);
}

function sjf() {
  queue = [...processes].sort((a, b) => a.burst - b.burst);
  animateProcesses();
}

function srtf() {
  let readyQueue = [];
  let completed = [];
  let gantt = [];
  let time = 0;
  
  processes.forEach(p => {
    p.remaining = p.burst;
    p.completion = 0;
  });

  function executeStep() {
    if (completed.length === processes.length) {
      finalizeResults(gantt);
      return;
    }

    // Add arriving processes
    processes.forEach(p => {
      if (p.arrival === time && !completed.includes(p)) {
        readyQueue.push(p);
      }
    });

    if (readyQueue.length > 0) {
      readyQueue.sort((a, b) => a.remaining - b.remaining);
      const current = readyQueue[0];
      
      // Execute for 1 unit
      drawProcess(current.name, 1, time);
      current.remaining--;
      gantt.push({process: current.name, time: time});
      
      if (current.remaining === 0) {
        current.completion = time + 1;
        current.turnaround = current.completion - current.arrival;
        current.waiting = current.turnaround - current.burst;
        completed.push(current);
        readyQueue.shift();
      }
    } else {
      drawProcess("Idle", 1, time);
      gantt.push({process: "Idle", time: time});
    }

    time++;
    document.getElementById('timer').innerText = `Current Time: ${time}`;
    updateQueueDisplay();
    
    setTimeout(() => {
      animationFrame = requestAnimationFrame(executeStep);
    }, 500);
  }

  executeStep();
}

function priorityPreemptive() {
  let readyQueue = [];
  let completed = [];
  let gantt = [];
  let time = 0;
  
  processes.forEach(p => {
    p.remaining = p.burst;
    p.completion = 0;
  });

  function executeStep() {
    if (completed.length === processes.length) {
      finalizeResults(gantt);
      return;
    }

    processes.forEach(p => {
      if (p.arrival === time && !completed.includes(p)) {
        readyQueue.push(p);
      }
    });

    if (readyQueue.length > 0) {
      readyQueue.sort((a, b) => a.priority - b.priority);
      const current = readyQueue[0];
      
      drawProcess(current.name, 1, time);
      current.remaining--;
      gantt.push({process: current.name, time: time});
      
      if (current.remaining === 0) {
        current.completion = time + 1;
        current.turnaround = current.completion - current.arrival;
        current.waiting = current.turnaround - current.burst;
        completed.push(current);
        readyQueue.shift();
      }
    } else {
      drawProcess("Idle", 1, time);
      gantt.push({process: "Idle", time: time});
    }

    time++;
    document.getElementById('timer').innerText = `Current Time: ${time}`;
    updateQueueDisplay();
    
    setTimeout(() => {
      animationFrame = requestAnimationFrame(executeStep);
    }, 500);
  }

  executeStep();
}

// Priority Non-Preemptive Algorithm
function priorityNonPreemptive() {
  queue = [...processes]
    .sort((a, b) => a.arrival - b.arrival) 
    .sort((a, b) => a.priority - b.priority);
  animateProcesses();
}

// Animation function
function animateProcesses(timeQuantum = null) {
  let localCurrentTime = 0;
  timeline.innerHTML = '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  function step() {
    if (queue.length === 0) {
      displayResults();
      return;
    }

    let process;

    process = queue.shift();

    if (process.arrival > localCurrentTime) {
      // Draw idle time block before process starts
      drawProcess("Idle", process.arrival - localCurrentTime, localCurrentTime);
      localCurrentTime = process.arrival;
    }

    const executionTime = timeQuantum
      ? Math.min(process.remaining, timeQuantum)
      : process.remaining;

    // Draw process block at current time
    drawProcess(process.name, executionTime, localCurrentTime);

    localCurrentTime += executionTime;
    process.remaining -= executionTime;

    if (process.remaining === 0 && process.completion === 0) {
      process.completion = localCurrentTime;
      process.turnaround = process.completion - process.arrival;
      process.waiting = process.turnaround - process.burst;
    }

    document.getElementById('timer').innerText = `Current Time: ${localCurrentTime}`;
    updateQueueDisplay();

    if (process.remaining > 0 && timeQuantum) {
      queue.push(process);
    }
    
    setTimeout(() => {
      animationFrame = requestAnimationFrame(step);
    }, 500);
  }

  animationFrame = requestAnimationFrame(step);
}

// Draw process on canvas
function drawProcess(name, duration, startTime) {
  if (duration <= 0) return;
  
  const x = startTime * 30;  // Scaling factor for block width
  const width = duration * 30;
  const height = 60;
  const y = 20;

  const color = name === "Idle" ? '#CCCCCC' : getProcessColor(name);

  // Draw process block
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, width, height);

  // Draw process name centered vertically and slightly padded horizontally
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x + 5, y + height / 2);

  // Draw timeline labels if not already drawn at this position
  const timelineLabels = timeline.querySelectorAll('.time-label');
  for (let label of timelineLabels) {
    if (label.style.left === `${x}px`) {
      return;
    }
  }

  // Start time label
  const startLabel = document.createElement('div');
  startLabel.className = 'time-label';
  startLabel.style.left = `${x}px`;
  startLabel.textContent = startTime;
  timeline.appendChild(startLabel);

  // End time label
  const endLabel = document.createElement('div');
  endLabel.className = 'time-label';
  endLabel.style.left = `${x + width}px`;
  endLabel.textContent = startTime + duration;
  timeline.appendChild(endLabel);
}

// Finalize results for preemptive algorithms
function finalizeResults(gantt) {
  displayResults();
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  timeline.innerHTML = '';
  
  let prevTime = gantt.length > 0 ? gantt[0].time : 0;
  let prevProcess = gantt.length > 0 ? gantt[0].process : null;
  let segmentStartTime = prevTime;

  for (let i = 1; i <= gantt.length; i++) {
    if (i === gantt.length || gantt[i].process !== prevProcess) {
      // Draw block for the segment
      const duration = gantt[i - 1].time + 1 - segmentStartTime;
      drawProcess(prevProcess, duration, segmentStartTime);      
      if (i < gantt.length) {
        segmentStartTime = gantt[i].time;
        prevProcess = gantt[i].process;
      }
    }
  }
}

// Display result summary table
function displayResults() {
  let totalTAT = 0;
  let totalWT = 0;

  let html = `
    <h3>Results:</h3>
    <table class="result-table">
      <tr>
        <th>Process</th>
        <th>Arrival</th>
        <th>Burst</th>
        ${processes.some(p => p.priority !== undefined) ? '<th>Priority</th>' : ''}
        <th>Completion</th>
        <th>Turnaround</th>
        <th>Waiting</th>
      </tr>
  `;

  processes.forEach(p => {
    html += `
      <tr>
        <td>${p.name}</td>
        <td>${p.arrival}</td>
        <td>${p.burst}</td>
        ${p.priority !== undefined ? `<td>${p.priority}</td>` : ''}
        <td>${p.completion}</td>
        <td>${p.turnaround}</td>
        <td>${p.waiting}</td>
      </tr>
    `;
    totalTAT += p.turnaround;
    totalWT += p.waiting;
  });

  html += `</table>`;
  html += `<p><strong>Average Turnaround Time:</strong> ${(totalTAT/processes.length).toFixed(2)}</p>`;
  html += `<p><strong>Average Waiting Time:</strong> ${(totalWT/processes.length).toFixed(2)}</p>`;

  document.getElementById('output').innerHTML = html;
}

// Reset all
function resetAll() {
  processes.length = 0;
  queue.length = 0;
  currentTime = 0;
  cancelAnimationFrame(animationFrame);
  availableColors.push(...Object.values(processColors));
  Object.keys(processColors).forEach(key => delete processColors[key]);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  timeline.innerHTML = '';
  updateQueueDisplay();
  updateDetailsTable();
  document.getElementById('output').innerHTML = '';
  document.getElementById('timer').innerText = 'Current Time: 0';
  document.getElementById('processName').value = '';
  document.getElementById('arrivalTime').value = '';
  document.getElementById('burstTime').value = '';
  document.getElementById('priority').value = '';
  document.getElementById('timeQuantum').value = '2';
  document.getElementById('algorithm').value = 'fcfs';

  toggleOptions();
}

// Toggle visibility of extra options
function toggleOptions() {
  const algo = document.getElementById('algorithm').value;
  const isPriorityAlgo = ['priorityPreemptive', 'priorityNonPreemptive'].includes(algo);

  document.getElementById('timeQuantumContainer').style.display =
    algo === 'roundRobin' ? 'block' : 'none';

  document.getElementById('priorityContainer').style.display =
    isPriorityAlgo ? 'block' : 'none';

  // Show priority column in table if needed
  const priorityHeader = document.querySelector('#priorityHeader');
  if (priorityHeader) {
    priorityHeader.style.display = isPriorityAlgo ? 'table-cell' : 'none';
  }

  updateDetailsTable();
}

// On load
window.onload = toggleOptions;

