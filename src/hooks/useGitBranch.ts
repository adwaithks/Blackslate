import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Resolves the git branch for a given directory path by walking up to find
 * `.git/HEAD`. Returns `null` when the path is not inside a git repo.
 *
 * Re-runs whenever `cwd` changes so the sidebar stays in sync as the user
 * navigates between projects.
 */
export function useGitBranch(cwd: string): string | null {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("git_branch", { cwd })
      .then(setBranch)
      .catch(() => setBranch(null));
  }, [cwd]);

  return branch;
}
