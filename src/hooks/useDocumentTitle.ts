import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "剧合规 - AI短剧/漫剧上线前合规预检 | 广电总局新规适配";
    };
  }, [title]);
}
