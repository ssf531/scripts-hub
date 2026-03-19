import { useParams } from "react-router-dom";
import { EmailCleanerPage } from "./scripts/EmailCleanerPage";
import { GenericScriptPage } from "./scripts/GenericScriptPage";

const PAGES: Record<string, (name: string) => React.ReactElement> = {
  "AI Email Cleaner": (name) => <EmailCleanerPage scriptName={name} />,
};

export function ScriptDetail() {
  const { name } = useParams<{ name: string }>();
  const scriptName = name ? decodeURIComponent(name) : "";

  const render = PAGES[scriptName];
  return render
    ? render(scriptName)
    : <GenericScriptPage scriptName={scriptName} />;
}
