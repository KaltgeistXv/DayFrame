import type { Project } from '@/lib/model';
export default function ProjectBadge({ project }: { project?: Project }) {
  if (!project) return null;
  return (
    <span
      className={'pill project-badge color' + project.color}
      title={project.title}
    >
      {project.title}
    </span>
  );
}
