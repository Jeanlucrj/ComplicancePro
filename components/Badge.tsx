import { getStatusColor } from '@/utils/formatters';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function Badge({ status, size = 'md' }: BadgeProps) {
  const { bg, text } = getStatusColor(status);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${bg} ${text} ${sizeClasses}`}
    >
      {status}
    </span>
  );
}
