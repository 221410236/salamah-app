// presentation/js/messages.js
window.showMessage = (msg) => showCustomAlert(msg, 'message');
window.showSuccess = (msg) => showCustomAlert(msg, 'success');
window.showError = (err) => {
  const msg = parseError(err);
  showCustomAlert(msg, 'error');
};

function parseError(err) {
  if (!err) return "Unknown error";

  
  if (typeof err === "string") {
    try {
      const data = JSON.parse(err); 
      return data.error || data.message || err;
    } catch {
      return err; 
    }
  }

  
  if (err.message) {
    try {
      const data = JSON.parse(err.message);
      return data.error || data.message || err.message;
    } catch {
      return err.message;
    }
  }

  
  if (typeof err === "object") {
    if (err.error) return err.error;
    if (err.message) return err.message;
  }


  return String(err);
}

function showCustomAlert(msg, type) {
  const box = document.getElementById('alertBox');
  if (!box) return;
  const text = document.getElementById('alertMessage');
  text.innerText = msg;
  box.className = `alert-box ${type} show`;
  setTimeout(hideAlert, 6000);
}

window.hideAlert = () => {
  const box = document.getElementById('alertBox');
  if (!box) return;
  box.className = 'alert-box hidden';
};

function showToast(message, timeout = 4000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  
  setTimeout(() => toast.classList.add("show"), 100);


  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}





// <!-- Custom Alert Box NEED TO BE ADDED IN EVERY HTML THAT HAS ANY ALERTS IN EVERY <BODY> -->
// <div id="alertBox" class="alert-box hidden">
//   <div class="alert-content">
//     <span id="alertMessage"></span>
//     <button onclick="hideAlert()">✖</button>
//   </div>
// </div>


// ALSO YOU NEED TO ADD THIS SCRIPT IN EVERY HTML THAT HAS ANY ALERTS IN EVERY <HEAD>
// <script src="/js/messages.js"></script>
