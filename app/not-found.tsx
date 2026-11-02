// 없는 주소나 없는 공고 번호로 들어왔을 때 보이는 한국어 안내
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-6 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">찾는 공고나 페이지가 없습니다.</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">주소를 확인하거나 첫 화면에서 다시 찾아보세요.</p>
      <Link href="/" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
        첫 화면으로 가기
      </Link>
    </div>
  );
}
