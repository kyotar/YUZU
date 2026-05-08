"use client";

type Props = {
  myEmoji: string;
  postCount: number;
};

export default function MyPageView({ myEmoji, postCount }: Props) {
  return (
    <section className="mypage-view">
      <h2 className="mypage-title font-display">
        <span aria-hidden>{myEmoji}</span> わたしの畑
      </h2>
      <p className="mypage-stat">
        🌱 みんなのつぶやき {postCount}個
      </p>
      <div className="mypage-pitch">
        アカウント登録するとAIが<br />
        あなたの思考を分析します
      </div>
      <button type="button" className="mypage-cta" aria-disabled="true">
        アカウント登録（準備中）
      </button>
    </section>
  );
}
