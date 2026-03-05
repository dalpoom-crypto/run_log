import { NavLink } from 'react-router-dom';

const AdminSidebar = () => {
  const menuItems = [
    { path: '/admin', label: '대시보드', icon: '📊', exact: true },
    { path: '/admin/users', label: '사용자 관리', icon: '👥' },
    { path: '/admin/content', label: '콘텐츠 관리', icon: '📝' },
    { path: '/admin/crews', label: '크루 관리', icon: '👥' },
    { path: '/admin/reports', label: '신고 관리', icon: '⚠️' },
    { path: '/admin/statistics', label: '통계', icon: '📈' },
    { path: '/admin/settings', label: '설정', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-73px)] sticky top-[73px]">
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-navy-700 text-white'
                  : 'text-navy-700 hover:bg-navy-100'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
