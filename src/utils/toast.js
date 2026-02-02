export const showToast = (message, type = 'success') => {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    // toast-container가 없으면 생성
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center';
    document.body.appendChild(container);
  }

  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 animate-slide-up mb-3 ${
    type === 'success' ? 'bg-navy-700' : 
    type === 'error' ? 'bg-red-500' : 
    'bg-navy-700'
  }`;
  toast.textContent = message;
  toast.style.animation = 'slideUp 0.3s ease-out';
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};
