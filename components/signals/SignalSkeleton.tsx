import React from 'react';

const SignalSkeleton: React.FC = () => {
    return (
        <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl overflow-hidden p-5 animate-pulse">
            <div className="flex justify-between mb-4">
                <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-800 rounded-lg"></div>
                    <div className="space-y-2">
                        <div className="w-24 h-6 bg-gray-800 rounded"></div>
                        <div className="w-32 h-4 bg-gray-800 rounded"></div>
                    </div>
                </div>
                <div className="text-right space-y-2">
                    <div className="w-20 h-8 bg-gray-800 rounded ml-auto"></div>
                    <div className="w-16 h-4 bg-gray-800 rounded ml-auto"></div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 py-4 border-y border-gray-800 mb-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                        <div className="w-12 h-3 bg-gray-800 rounded"></div>
                        <div className="w-16 h-5 bg-gray-800 rounded"></div>
                    </div>
                ))}
            </div>

            <div className="space-y-3 mb-6">
                <div className="w-full h-4 bg-gray-800 rounded"></div>
                <div className="w-3/4 h-4 bg-gray-800 rounded"></div>
            </div>

            <div className="flex gap-2 mb-4">
                <div className="w-full h-10 bg-gray-800 rounded"></div>
            </div>
        </div>
    );
};

export default SignalSkeleton;
