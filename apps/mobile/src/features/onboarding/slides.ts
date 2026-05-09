export type OnboardingSlide = {
  id: string;
  titleRo: string;
  bodyRo: string;
  accent: string;
};

export const onboardingSlides: OnboardingSlide[] = [
  {
    id: "academia",
    titleRo: "Academia Dan Matei",
    bodyRo:
      "Antrenori dedicați. Programe pentru toate vârstele. Fotbal cu disciplină și pasiune.",
    accent: "#f59e0b",
  },
  {
    id: "comunitate",
    titleRo: "O comunitate puternică",
    bodyRo: "Părinți, copii și antrenori — împreună la fiecare meci.",
    accent: "#10b981",
  },
  {
    id: "performanta",
    titleRo: "Performanță vizibilă",
    bodyRo: "Urmărește progresul, programul și rezultatele direct din aplicație.",
    accent: "#3b82f6",
  },
];
