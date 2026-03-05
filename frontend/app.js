const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const placeholder = document.getElementById('placeholder');
const startCameraBtn = document.getElementById('startCamera');
const captureBtn = document.getElementById('captureBtn');
const resultCard = document.getElementById('result');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resultTimestamp = document.getElementById('resultTimestamp');
const resultIcon = document.getElementById('resultIcon');
const analyticsEl = document.getElementById('analytics');
const enrollForm = document.getElementById('enrollForm');
const captureEnrollBtn = document.getElementById('captureEnroll');
const employeeIdInput = document.getElementById('employeeId');
const empNameInput = document.getElementById('empName');
const empEmailInput = document.getElementById('empEmail');
const empDeptInput = document.getElementById('empDept');

let stream = null;
let capturedBlob = null;

const API_BASE = CONFIG.API_BASE.replace(/\/$/, '');
const auth = window.AttendanceAuth;

async function getUploadUrl(type = 'attendance') {
  const res = await fetch(`${API_BASE}/upload-url`, {
    method: 'POST',
    headers: auth.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type, fileName: `${Date.now()}.jpg` }),
  });
  if (!res.ok) throw new Error('Failed to get upload URL');
  return res.json();
}

async function uploadToS3(url, blob) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) throw new Error('Upload failed');
}

async function checkAttendance(key, bucket) {
  const res = await fetch(`${API_BASE}/check-attendance`, {
    method: 'POST',
    headers: auth.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ key, bucket }),
  });
  return res.json();
}

async function enrollEmployee(data) {
  const res = await fetch(`${API_BASE}/enroll`, {
    method: 'POST',
    headers: auth.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return res.json();
}

async function getAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${API_BASE}/analytics?period=daily&date=${today}`, {
    headers: auth.authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
    video.srcObject = stream;
    placeholder.classList.add('hidden');
    video.classList.remove('hidden');
    startCameraBtn.disabled = true;
    captureBtn.disabled = false;
  } catch (e) {
    alert('Could not access camera: ' + e.message);
  }
}

async function captureAndCheckIn() {
  if (!stream) return;
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  await processAttendance(blob);
}

async function processAttendance(blob) {
  resultCard.classList.remove('hidden');
  resultCard.classList.remove('success', 'error');
  resultTitle.textContent = 'Processing...';
  resultMessage.textContent = '';
  resultTimestamp.textContent = '';
  captureBtn.disabled = true;

  try {
    if (!auth.getIdToken()) {
      throw new Error('Please login first.');
    }
    const { uploadUrl, key, bucket } = await getUploadUrl('attendance');
    await uploadToS3(uploadUrl, blob);
    const data = await checkAttendance(key, bucket);

    if (data.recognized) {
      resultCard.classList.add('success');
      resultTitle.textContent = 'Check-in Successful';
      resultMessage.textContent = data.employee?.name
        ? `Welcome, ${data.employee.name}!`
        : `Employee ID: ${data.employeeId}`;
      resultTimestamp.textContent = data.attendance?.timestamp
        ? new Date(data.attendance.timestamp).toLocaleString()
        : '';
      if (data.attendance?.status === 'already_recorded') {
        resultMessage.textContent += ' (Already recorded today)';
      }
    } else {
      resultCard.classList.add('error');
      resultTitle.textContent = 'Not Recognized';
      resultMessage.textContent = data.message || 'No matching face found. Please enroll first.';
    }
  } catch (e) {
    resultCard.classList.add('error');
    resultTitle.textContent = 'Error';
    resultMessage.textContent = e.message || 'Something went wrong.';
  }

  captureBtn.disabled = false;
  loadAnalytics();
}

async function loadAnalytics() {
  try {
    const data = await getAnalytics();
    if (data) {
      analyticsEl.innerHTML = `
        <div class="analytics-stats">
          <div class="analytics-stat">
            <div class="value">${data.uniqueEmployees}</div>
            <div class="label">Employees Checked In</div>
          </div>
          <div class="analytics-stat">
            <div class="value">${data.totalCheckIns}</div>
            <div class="label">Total Check-ins</div>
          </div>
        </div>
      `;
    } else {
      analyticsEl.innerHTML = '<p>Analytics unavailable. Configure API endpoint.</p>';
    }
  } catch {
    analyticsEl.innerHTML = '<p>Analytics unavailable.</p>';
  }
}

captureEnrollBtn.addEventListener('click', async () => {
  if (!stream) {
    await startCamera();
    captureEnrollBtn.textContent = 'Capturing... (click again)';
    return;
  }
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  capturedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  enrollForm.querySelector('button[type="submit"]').disabled = false;
  captureEnrollBtn.textContent = 'Photo captured ✓';
});

enrollForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!capturedBlob) {
    alert('Please capture a photo first');
    return;
  }
  if (!auth.getIdToken()) {
    alert('Please login first');
    return;
  }
  const submitBtn = enrollForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enrolling...';

  try {
    const { uploadUrl, key, bucket } = await getUploadUrl('enrollment');
    await uploadToS3(uploadUrl, capturedBlob);
    const data = await enrollEmployee({
      key,
      bucket,
      employeeId: employeeIdInput.value.trim(),
      name: empNameInput.value.trim(),
      email: empEmailInput.value.trim(),
      department: empDeptInput.value.trim(),
    });
    if (data.success) {
      alert('Employee enrolled successfully!');
      enrollForm.reset();
      capturedBlob = null;
      captureEnrollBtn.textContent = 'Capture Photo';
    } else {
      alert('Enrollment failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Enroll';
});

startCameraBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureAndCheckIn);

loadAnalytics();
