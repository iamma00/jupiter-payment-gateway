import dynamic from "next/dynamic";
import Layout from "../components/Layout";

// Dynamically import PaymentCard to ensure no SSR conflicts with wallet
const PaymentCard = dynamic(() => import("../components/PaymentCard"), {
  ssr: false,
});

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center w-full px-4 py-12">
        <PaymentCard />
      </div>
    </Layout>
  );
}
