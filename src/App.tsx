import { createBrowserRouter, RouterProvider } from "react-router";

import { Layout } from "@/components/layout/Layout";
import { DonatePage } from "@/features/donate/DonatePage";
import { ReceiptPage } from "@/features/receipt/ReceiptPage";
import { NotFound } from "@/pages/NotFound";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DonatePage /> },
      { path: "receipt/:donationId", element: <ReceiptPage /> },
      // The return URL the API hands Easebuzz (easebuzz_checkout.js → surl/furl), in case
      // Easebuzz ever redirects the donor instead of answering the checkout window.
      { path: "app/paymentdetails/receipt/:donationId/:orderId", element: <ReceiptPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
