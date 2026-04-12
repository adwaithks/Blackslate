import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Looks up the current branch name for a folder, or null if it's not a git repo. Updates when the folder changes.
export function useGitBranch(cwd: string): string | null {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("git_branch", { cwd })
      .then(setBranch)
      .catch(() => setBranch(null));
  }, [cwd]);

  return branch;
}
