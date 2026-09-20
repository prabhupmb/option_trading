import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

class PortfolioErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[Portfolio] Render error:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="flex-1 overflow-y-auto bg-[#080b10] min-h-screen text-white font-sans">
                    <div className="max-w-[1600px] mx-auto p-5 lg:p-7">
                        <div className="bg-[#0d1117] rounded-2xl border border-red-500/25 p-12 text-center space-y-4">
                            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                            <h2 className="text-lg font-bold text-red-400">Portfolio failed to render</h2>
                            <p className="text-sm text-slate-500 font-mono max-w-xl mx-auto break-all">
                                {this.state.error.message}
                            </p>
                            <button
                                onClick={() => this.setState({ error: null })}
                                className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-bold hover:bg-blue-600/30 transition-colors"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default PortfolioErrorBoundary;
