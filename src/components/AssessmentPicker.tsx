import { content } from '../lib/content/index.ts';
import { displayName, type DiagnosticWorkspace } from '../lib/state/diagnostic-model.ts';
import styles from './AssessmentPicker.module.css';

/** Chooses one of the assessments saved in this browser, newest first. The page reads it and never changes it. */
export function AssessmentPicker({
  workspace,
  id,
  label,
  none,
  value,
  onChange,
}: {
  workspace: DiagnosticWorkspace;
  id: string;
  label: string;
  none: string;
  value: string;
  onChange: (assessmentId: string) => void;
}) {
  const { diagnostic } = content.site;
  const assessments = [...workspace.assessments].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{none}</option>
        {assessments.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {displayName(
              workspace.organizations.find((o) => o.id === candidate.organizationId)?.answers ?? {},
              'orgName',
              diagnostic.untitledOrganization,
            )}
            {' — '}
            {displayName(candidate.answers, 'useCaseName', diagnostic.untitledAssessment)}
          </option>
        ))}
      </select>
    </div>
  );
}
