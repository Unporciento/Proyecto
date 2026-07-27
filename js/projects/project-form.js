import { makeProjectRecord } from '../academic/project-model.js';

const $ = selector => document.querySelector(selector);

function dateValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function resetProjectForm() {
  $('#projectForm').reset();
  $('#projectStatus').value = 'active';
  $('#projectProgress').value = '0';
  $('#projectColor').value = '#b9ef73';
  $('#projectIcon').value = 'book';
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  $('#projectStartDate').value = dateValue(today);
  $('#projectDueDate').value = dateValue(due);
}

export function fillProjectForm(project) {
  $('#projectName').value = project.title;
  $('#projectSubject').value = project.subjectId;
  $('#projectProfessor').value = project.professor || '';
  $('#projectSemester').value = project.semester || '';
  $('#projectStatus').value = project.status;
  $('#projectStartDate').value = project.startDate || '';
  $('#projectDueDate').value = project.dueDate || '';
  $('#projectProgress').value = project.progress ?? 0;
  $('#projectColor').value = project.color || '#b9ef73';
  $('#projectIcon').value = project.icon || 'book';
  $('#projectDescription').value = project.description;
}

export function projectInput() {
  return {
    title: $('#projectName').value,
    subjectId: $('#projectSubject').value,
    professor: $('#projectProfessor').value,
    semester: $('#projectSemester').value,
    status: $('#projectStatus').value,
    startDate: $('#projectStartDate').value,
    dueDate: $('#projectDueDate').value,
    progress: $('#projectProgress').value,
    color: $('#projectColor').value,
    icon: $('#projectIcon').value,
    description: $('#projectDescription').value
  };
}

export function projectRecord(existing = null) {
  const id = existing?.id || `project_${crypto.randomUUID()}`;
  return makeProjectRecord(projectInput(), { id, existing });
}
