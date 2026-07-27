const STATUS_LABELS = Object.freeze({
  active: 'Activo',
  submitted: 'Entregado',
  graded: 'Calificado',
  archived: 'Archivado'
});
const ICONS = Object.freeze({
  book: '▤',
  wrench: '⚙',
  flask: '⚗',
  calculator: '∑',
  health: '✚',
  code: '⌘',
  briefcase: '▣',
  star: '★'
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`));
}

function action(project, name, label, className = 'project-action') {
  const button = node('button', className, label);
  button.type = 'button';
  button.dataset.projectAction = name;
  button.dataset.projectId = project.id;
  button.setAttribute('aria-label', `${label}: ${project.title}`);
  return button;
}

function projectCard(project, subjectName) {
  const card = node('article', 'project-card');
  card.dataset.projectId = project.id;
  card.style.setProperty('--project-color', project.color || '#b9ef73');

  const header = node('div', 'project-card-head');
  const icon = node('span', 'project-icon', ICONS[project.icon] || ICONS.book);
  icon.setAttribute('aria-hidden', 'true');
  const state = node('span', `project-status ${project.status}`, STATUS_LABELS[project.status]);
  header.append(icon, state);

  const title = node('h2', '', project.title);
  const subject = node('p', 'project-subject', subjectName || 'Asignatura desconocida');
  const description = node(
    'p',
    'project-description',
    project.description || 'Sin descripción todavía.'
  );

  const details = node('dl', 'project-details');
  const dueTerm = node('dt', '', 'Entrega');
  const dueValue = node('dd', '', project.dueDate ? dateLabel(project.dueDate) : 'Sin fecha');
  const semesterTerm = node('dt', '', 'Semestre');
  const semesterValue = node('dd', '', project.semester || 'Sin definir');
  details.append(dueTerm, dueValue, semesterTerm, semesterValue);

  const progress = node('div', 'project-progress');
  const progressCopy = node('span', '', `Progreso ${project.progress ?? 0}%`);
  const bar = node('div', 'bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', String(project.progress ?? 0));
  const fill = node('i');
  fill.style.width = `${project.progress ?? 0}%`;
  bar.append(fill);
  progress.append(progressCopy, bar);

  const actions = node('div', 'project-card-actions');
  actions.append(action(project, 'sources', 'Fuentes', 'project-action primary'));
  actions.append(action(project, 'edit', 'Editar'));
  if (project.status !== 'archived') actions.append(action(project, 'archive', 'Archivar'));
  actions.append(action(project, 'delete', 'Eliminar', 'project-action danger'));

  card.append(header, title, subject, description, details, progress, actions);
  return card;
}

export function renderProjects(target, projects, subjects, { append = false } = {}) {
  if (!append) target.replaceChildren();
  if (!projects.length && !append) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '▦'),
      node('h3', '', 'No hay proyectos en esta vista'),
      node('p', '', 'Crea un proyecto o cambia los filtros seleccionados.')
    );
    target.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  projects.forEach(project =>
    fragment.append(projectCard(project, subjects.get(project.subjectId)))
  );
  target.append(fragment);
}

export function fillSubjectSelects(subjects) {
  const form = document.querySelector('#projectSubject');
  const filter = document.querySelector('#projectSubjectFilter');
  form.replaceChildren();
  filter.replaceChildren(new Option('Todas', ''));
  subjects.forEach(subject => {
    form.add(new Option(subject.name, subject.id));
    filter.add(new Option(subject.name, subject.id));
  });
}

export function renderProjectSummary(count, hasMore) {
  const target = document.querySelector('#projectSummary');
  target.textContent = count
    ? `${count} proyecto${count === 1 ? '' : 's'} visible${count === 1 ? '' : 's'}${hasMore ? ' · hay más resultados' : ''}`
    : 'Sin proyectos para estos filtros';
}
