import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
};

export function MenuButton({ icon: Icon, title, description, onClick }: Props) {
  return (
    <button className="menu-button" onClick={onClick}>
      <div className="menu-button__icon">
        <Icon size={20} />
      </div>
      <div>
        <p className="menu-button__text-primary">{title}</p>
        <p className="menu-button__text-secondary">{description}</p>
      </div>
    </button>
  );
}
