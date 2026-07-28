import React from 'react';
import { ChevronDown, Filter } from 'lucide-react';

const TransactionHistory = () => {
  const transactions = [
    {
      date: "11 Jan '26",
      items: [
        { name: "Aditya Birla Sun Life PSU Equity Fund Direct Growth", type: "One-time", amount: "₹15,000", time: "03:48 pm", status: "success" },
        { name: "Nippon India Large Cap Fund Direct Growth", type: "One-time", amount: "₹20,000", time: "03:47 pm", status: "success" },
        { name: "HDFC Mid Cap Fund Direct Growth", type: "One-time", amount: "₹35,000", time: "03:43 pm", status: "success" },
      ]
    },
    {
      date: "9 Jan '26",
      items: [
        { name: "HDFC Mid Cap Fund Direct Growth", type: "One-time", amount: "₹35,000", time: "04:37 pm", status: "failed" },
      ]
    }
  ];

  return (
    <div className="bg-gray-50 min-h-screen p-4 font-sans text-gray-900">
      <h1 className="text-2xl font-bold mb-6">Transaction History</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <button className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">
          Order type <ChevronDown size={16} />
        </button>
        <button className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">
          Status <ChevronDown size={16} />
        </button>
        <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">
          Purchase
        </button>
        <button className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium whitespace-nowrap">
          Redeem
        </button>
      </div>

      {/* Transaction List */}
      <div className="space-y-8">
        {transactions.map((group, idx) => (
          <div key={idx}>
            <h2 className="text-gray-500 font-medium mb-3">{group.date}</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className={`p-4 flex flex-col gap-2 ${itemIdx !== group.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-semibold text-[15px] leading-tight flex-1">{item.name}</h3>
                    <span className="font-bold text-lg">{item.amount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{item.type}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistory;