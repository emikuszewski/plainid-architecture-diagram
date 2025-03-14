import React, { useState } from 'react';
import { Server, Database, Cloud, Shield, ArrowDown, Users, Lock, Zap, Layers, Box, GitBranch, Info, Menu, X, ExternalLink, Home, Settings, HelpCircle } from 'lucide-react';

const ArchitectureDiagram = () => {
  const [activeComponent, setActiveComponent] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState({ title: '', description: '' });
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleComponentClick = (component, position) => {
    setActiveComponent(component === activeComponent ? null : component);
    
    if (component === activeComponent) {
      setShowTooltip(false);
    } else {
      setShowTooltip(true);
      setTooltipPosition(position);
      
      const tooltips = {
        lb: {
          title: 'Load Balancer',
          description: 'Distributes incoming traffic across multiple servers to ensure high availability and reliability.'
        },
        oauth: {
          title: 'OAuth',
          description: 'Handles authentication and provides secure tokens for authorization, enabling secure access to protected resources.'
        },
        pap: {
          title: 'Policy Administration Point',
          description: 'Central management system for defining, storing, and managing access policies. Serves as the policy source of truth.'
        },
        cloudPdp: {
          title: 'Cloud PDP',
          description: 'Policy Decision Point in the cloud that evaluates access requests against policies and returns permit/deny decisions.'
        },
        postgres: {
          title: 'PostgreSQL Database',
          description: 'Stores policy definitions, configurations, and administrative data for the platform.'
        },
        saasRedis: {
          title: 'REDIS Cache (SaaS)',
          description: 'High-performance cache used by services to optimize policy evaluation and decision-making.'
        },
        tunnel: {
          title: 'Secured Communication Tunnel',
          description: 'Encrypted connection between SaaS and customer environment that ensures secure and private data transfer.'
        },
        agent: {
          title: 'Agent',
          description: 'Lightweight component deployed in the customer environment that handles policy enforcement and communicates with the SaaS platform.'
        },
        pip: {
          title: 'PIP Operator',
          description: 'Policy Information Point that gathers additional attributes and contextual information needed for policy evaluation.'
        },
        pdp: {
          title: 'Policy Decision Point',
          description: 'Evaluates access requests against established policies and determines whether access should be granted or denied.'
        },
        authorizers: {
          title: 'Authorizers',
          description: 'Components that enforce authorization decisions at various access points within the customer environment.'
        },
        dataStores: {
          title: 'Customer Data Stores',
          description: 'Customer databases and data repositories that may require access control and policy enforcement.'
        },
        customerApps: {
          title: 'Customer Apps/Services',
          description: 'Applications and services that integrate with authorization for access control capabilities.'
        },
        idp: {
          title: 'Identity Provider (IDP)',
          description: 'Manages user identities and authentication, providing verified identity information to the authorization system.'
        },
        customerRedis: {
          title: 'Customer REDIS Store',
          description: 'Customer-managed REDIS instance used for high-performance caching and data access.'
        }
      };
      
      setTooltipContent(tooltips[component] || { title: 'Component', description: 'No description available' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - simplified with no navigation elements */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-gray-800">Authorization Architecture</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Page Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <p className="text-gray-600">
            Interactive visualization of the authorization platform architecture. Click on any component to learn more.
          </p>
        </div>
        
        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sticky top-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Architecture Components</h3>
              
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-3 py-1">
                  <h4 className="font-medium text-blue-800">PlainID SaaS Platform</h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    <li><a href="#" className="text-gray-600 hover:text-blue-600 flex items-center"><Lock size={14} className="mr-1" /> OAuth</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-blue-600 flex items-center"><GitBranch size={14} className="mr-1" /> Load Balancer</a></li>
                    <li><a href="#" className="text-blue-600 font-medium flex items-center"><Server size={14} className="mr-1" /> PAP Services</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-blue-600 flex items-center"><Cloud size={14} className="mr-1" /> Cloud PDP</a></li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-green-500 pl-3 py-1">
                  <h4 className="font-medium text-green-800">Customer Environment</h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    <li><a href="#" className="text-gray-600 hover:text-green-600 flex items-center"><Shield size={14} className="mr-1" /> Agent</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-green-600 flex items-center"><Zap size={14} className="mr-1" /> PDP & PIP</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-green-600 flex items-center"><Box size={14} className="mr-1" /> Authorizers</a></li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-purple-500 pl-3 py-1">
                  <h4 className="font-medium text-purple-800">Managed Services</h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    <li><a href="#" className="text-gray-600 hover:text-purple-600 flex items-center"><Database size={14} className="mr-1" /> Postgres DB</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-purple-600 flex items-center"><Database size={14} className="mr-1" /> REDIS Store</a></li>
                    <li><a href="#" className="text-gray-600 hover:text-purple-600 flex items-center"><Users size={14} className="mr-1" /> IDP</a></li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Resources</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="https://docs.plainid.io/docs/architecture-diagram-and-high-level-components-1" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600 flex items-center"><ExternalLink size={14} className="mr-2" /> Documentation</a></li>
                  <li><a href="https://docs.plainid.io/docs/architecture-diagram-and-high-level-components-1" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600 flex items-center"><ExternalLink size={14} className="mr-2" /> Deployment Guide</a></li>
                  <li><a href="https://docs.plainid.io/docs/architecture-diagram-and-high-level-components-1" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600 flex items-center"><ExternalLink size={14} className="mr-2" /> API Reference</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start">
              <Info size={24} className="text-blue-600 mr-3 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-blue-800 font-medium mb-1">Understanding the Architecture</h3>
                <p className="text-sm text-gray-700">
                  The architecture consists of a SaaS platform and components deployed in the customer environment.
                  The components communicate securely to enforce authorization policies across your applications and services.
                  Click on any component in the diagram below to learn more about its role in the architecture.
                </p>
              </div>
            </div>
            
            {/* Interactive Diagram */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6 relative">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Interactive Architecture Diagram</h3>
              
              {/* SaaS Platform */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-blue-800">PlainID SaaS Platform</h3>
                  <Cloud size={20} className="text-blue-600" />
                </div>
                
                <div className="flex justify-center space-x-4 mb-4">
                  <div 
                    className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'lb' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-100'}`}
                    onClick={() => handleComponentClick('lb', { top: 250, left: 240 })}
                  >
                    <div className="flex flex-col items-center">
                      <GitBranch size={24} className="text-blue-600" />
                      <span className="text-sm mt-1">Load Balancer</span>
                    </div>
                  </div>
                  
                  <div 
                    className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'oauth' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-100'}`}
                    onClick={() => handleComponentClick('oauth', { top: 250, left: 400 })}
                  >
                    <div className="flex flex-col items-center">
                      <Lock size={24} className="text-blue-600" />
                      <span className="text-sm mt-1">OAuth</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div 
                    className={`cursor-pointer col-span-2 p-4 rounded-lg ${activeComponent === 'pap' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-blue-500 text-white'}`}
                    onClick={() => handleComponentClick('pap', { top: 350, left: 320 })}
                  >
                    <div className="font-medium mb-2">Policy Administration Point (PAP)</div>
                    <div className="text-sm bg-blue-400 bg-opacity-80 p-2 rounded-md mb-2">PAP Services</div>
                    <div className="text-sm bg-blue-400 bg-opacity-80 p-2 rounded-md">Agent Server</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div 
                      className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'cloudPdp' ? 'bg-blue-100 ring-2 ring-blue-400 text-blue-800' : 'bg-blue-600 text-white'}`}
                      onClick={() => handleComponentClick('cloudPdp', { top: 320, left: 500 })}
                    >
                      <div className="flex flex-col items-center">
                        <Cloud size={20} className={activeComponent === 'cloudPdp' ? 'text-blue-600' : 'text-white'} />
                        <span className="text-sm mt-1">Cloud PDP</span>
                      </div>
                    </div>
                    
                    <div 
                      className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'postgres' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-100'}`}
                      onClick={() => handleComponentClick('postgres', { top: 400, left: 500 })}
                    >
                      <div className="flex flex-col items-center">
                        <Database size={20} className="text-blue-600" />
                        <span className="text-sm mt-1">Postgres DB</span>
                      </div>
                    </div>
                    
                    <div 
                      className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'saasRedis' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-100'}`}
                      onClick={() => handleComponentClick('saasRedis', { top: 480, left: 500 })}
                    >
                      <div className="flex flex-col items-center">
                        <Database size={20} className="text-red-600" />
                        <span className="text-sm mt-1">REDIS Store</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Communication Tunnel */}
              <div 
                className={`cursor-pointer flex justify-center items-center py-3 mb-6 border border-dashed ${activeComponent === 'tunnel' ? 'border-blue-500 bg-blue-50' : 'border-gray-400'}`}
                onClick={() => handleComponentClick('tunnel', { top: 540, left: 320 })}
              >
                <Lock size={16} className={activeComponent === 'tunnel' ? 'text-blue-600 mr-1' : 'text-gray-600 mr-1'} />
                <span className="font-medium">Secured Communication Tunnel</span>
                <ArrowDown size={16} className={activeComponent === 'tunnel' ? 'text-blue-600 ml-1' : 'text-gray-600 ml-1'} />
              </div>
              
              {/* Customer Environment */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-green-800">Customer Environment</h3>
                  <Server size={20} className="text-green-600" />
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div 
                    className={`cursor-pointer col-span-2 p-4 rounded-lg ${activeComponent === 'agent' ? 'bg-green-100 ring-2 ring-green-400' : 'bg-green-500 text-white'}`}
                    onClick={() => handleComponentClick('agent', { top: 620, left: 320 })}
                  >
                    <div className="font-medium mb-2">Policy Authorization Agent (PAA)</div>
                    <div className="text-sm bg-green-400 bg-opacity-80 p-2 rounded-md mb-3">Agent</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        className={`cursor-pointer p-2 rounded-md text-center ${activeComponent === 'pip' ? 'bg-white text-green-800' : 'bg-green-400 bg-opacity-80'}`}
                        onClick={(e) => { e.stopPropagation(); handleComponentClick('pip', { top: 670, left: 280 }); }}
                      >
                        <span className="text-sm">PIP Operator</span>
                      </div>
                      <div 
                        className={`cursor-pointer p-2 rounded-md text-center ${activeComponent === 'pdp' ? 'bg-white text-green-800' : 'bg-green-400 bg-opacity-80'}`}
                        onClick={(e) => { e.stopPropagation(); handleComponentClick('pdp', { top: 670, left: 370 }); }}
                      >
                        <span className="text-sm">PDP</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div 
                      className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'dataStores' ? 'bg-green-100 ring-2 ring-green-400' : 'bg-gray-100'}`}
                      onClick={() => handleComponentClick('dataStores', { top: 620, left: 500 })}
                    >
                      <div className="flex flex-col items-center">
                        <Database size={20} className="text-gray-600" />
                        <span className="text-sm mt-1 text-center">Customer Data Stores</span>
                      </div>
                    </div>
                    
                    <div 
                      className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'customerApps' ? 'bg-green-100 ring-2 ring-green-400' : 'bg-gray-100'}`}
                      onClick={() => handleComponentClick('customerApps', { top: 680, left: 500 })}
                    >
                      <div className="flex flex-col items-center">
                        <Layers size={20} className="text-gray-600" />
                        <span className="text-sm mt-1 text-center">Customer Apps</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div 
                  className={`cursor-pointer mb-4 p-3 rounded-lg ${activeComponent === 'authorizers' ? 'bg-green-100 ring-2 ring-green-400' : 'bg-teal-500 text-white'}`}
                  onClick={() => handleComponentClick('authorizers', { top: 740, left: 320 })}
                >
                  <div className="flex items-center justify-center">
                    <Shield size={20} className={activeComponent === 'authorizers' ? 'text-teal-600 mr-2' : 'text-white mr-2'} />
                    <span className="font-medium">Authorizers</span>
                  </div>
                </div>
              </div>
              
              {/* Customer Managed Services */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-purple-800">Customer's Managed Services</h3>
                  <Server size={20} className="text-purple-600" />
                </div>
                
                <div className="flex justify-center items-center space-x-6">
                  <div 
                    className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'idp' ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-gray-100'}`}
                    onClick={() => handleComponentClick('idp', { top: 820, left: 240 })}
                  >
                    <div className="flex flex-col items-center">
                      <Users size={20} className="text-purple-600" />
                      <span className="text-sm mt-1">Identity Provider (IDP)</span>
                    </div>
                  </div>
                  
                  <div 
                    className={`cursor-pointer p-3 rounded-lg ${activeComponent === 'customerRedis' ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-gray-100'}`}
                    onClick={() => handleComponentClick('customerRedis', { top: 820, left: 400 })}
                  >
                    <div className="flex flex-col items-center">
                      <Database size={20} className="text-red-600" />
                      <span className="text-sm mt-1">REDIS Store</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Tooltip */}
              {showTooltip && (
                <div 
                  className="absolute z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-72"
                  style={{ 
                    top: tooltipPosition.top,
                    left: tooltipPosition.left > 400 ? 'auto' : tooltipPosition.left,
                    right: tooltipPosition.left > 400 ? '20px' : 'auto',
                    transform: 'translateY(10px)'
                  }}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-blue-800">{tooltipContent.title}</h4>
                    <button 
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setShowTooltip(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{tooltipContent.description}</p>
                  <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                    <a href="https://docs.plainid.io/docs/architecture-diagram-and-high-level-components-1" target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:text-blue-800 flex items-center">
                      Learn more <ExternalLink size={14} className="ml-1" />
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Component Legend</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-sm">SaaS Components</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm">Customer Environment</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                  <span className="text-sm">Managed Services</span>
                </div>
                <div className="flex items-center">
                  <Database size={16} className="text-red-600 mr-2" />
                  <span className="text-sm">REDIS Storage</span>
                </div>
                <div className="flex items-center">
                  <Database size={16} className="text-blue-600 mr-2" />
                  <span className="text-sm">Postgres Storage</span>
                </div>
                <div className="flex items-center">
                  <Shield size={16} className="text-teal-600 mr-2" />
                  <span className="text-sm">Authorization Components</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Simple Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          Made by the SE Team for Walkthrough Purposes Only
        </div>
      </footer>
    </div>
  );
};

export default ArchitectureDiagram;
