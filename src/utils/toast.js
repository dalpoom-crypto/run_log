export const showToast = (message, type = 'success') => {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    // toast-container가 없으면 생성 (index.html에 있지만 혹시 모를 경우를 대비)
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `px-6 py-3 rounded-lg shadow-lg text-white font-medium mb-3 ${
    type === 'success' ? 'bg-navy-700' : 
    type === 'error' ? 'bg-red-500' : 
    type === 'info' ? 'bg-blue-500' :
    'bg-navy-700'
  }`;
  toast.textContent = message;
  
  // 즉시 올바른 위치에 표시되도록 스타일 설정
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(20px)';
  toast.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
  
  toastContainer.appendChild(toast);
  
  // 다음 프레임에서 애니메이션 시작 (레이아웃 계산 후)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 2000);
};
