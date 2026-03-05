const StatsCard = ({ title, value, subtitle, icon, trend, onClick }) => {
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-navy-600 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-navy-900">{value}</h3>
          {subtitle && (
            <p className="text-xs text-navy-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-4xl opacity-50">{icon}</div>
        )}
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`text-sm font-semibold flex items-center gap-1 ${
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-navy-600'
        }`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} 
          {trend !== 0 && `${Math.abs(trend)}%`}
          {trend === 0 && '변동 없음'}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
