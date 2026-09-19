export default function PortalHeading({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description?: string; children?: React.ReactNode;
}) {
  return <div className="portal-heading">
    <p className="eyebrow"><span />{eyebrow}</p>
    <h1>{title}</h1>
    {description && <p className="portal-description">{description}</p>}
    {children}
  </div>;
}
