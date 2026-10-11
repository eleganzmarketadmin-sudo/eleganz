import styles from "./StatusTag.module.css";

type Humeur = "paye" | "attente" | "alerte" | "neutre";

const classes: Record<Humeur, string> = {
  paye: styles.paye,
  attente: styles.attente,
  alerte: styles.alerte,
  neutre: styles.neutre,
};

export function StatusTag({ label, humeur = "neutre" }: { label: string; humeur?: Humeur }) {
  return <span className={`${styles.tag} ${classes[humeur]}`}>{label}</span>;
}
