import {describe,expect,it} from 'vitest';
import {createScenario,type FinanceInput} from './contracts';
import {evaluateConditionalFinancials} from './financial-scenarios';

const finance:FinanceInput={
 unitPrice:900000,installation:300000,infrastructure:200000,chargersCost:140000,
 maintenanceAnnual:260000,electricityPerKwh:10,baselineCostAnnual:4800000,
 residualHumanCostAnnual:900000,daysPerYear:250,horizonYears:5,discountRatePercent:15,
 annualDemand:3500,baselineAnnualCompleted:3500
};
const simulated={completed:10.6,energyKwh:.3324,backlog:2};

describe('partial automation cash flow is explicitly conditional',()=>{
 it('separates 2650 finished goods/year from the 3500 annual plan',()=>{
  const r=evaluateConditionalFinancials(createScenario('factory'),simulated,finance,null);
  expect(r.annualCompleted).toBe(2650);
  expect(r.annualShortfall).toBe(850);
  expect(r.coveragePercent).toBeCloseTo(2650/3500*100,8);
  expect(r.financiallySpecified).toBe(true);
  expect(r.assumedRoiPercent).toBeNull();
  expect(r.assumedNpv).toBeNull();
  const net=4800000-900000-(260000+.3324*250*10);
  const capex=4*900000+300000+200000+140000; // explicitly four robots in this test
  const s=createScenario('factory');s.robot.count=4;
  const four=evaluateConditionalFinancials(s,simulated,finance,null);
  expect(four.upperBoundRoiPercent).toBeCloseTo((net*5-capex)/capex*100,8);
  expect(four.upperBoundNpv).toBeCloseTo(-capex+Array.from({length:5},(_,i)=>net/(1.15)**(i+1)).reduce((a,b)=>a+b,0),7);
 });
 it('charges an explicitly entered annual cost against conditional ROI NPV and TCO',()=>{
  const s=createScenario('factory');s.robot.count=4;
  const upper=evaluateConditionalFinancials(s,simulated,finance,null);
  const priced=evaluateConditionalFinancials(s,simulated,finance,1000000);
  expect(priced.annualShortfall).toBe(850);
  expect(priced.assumedNetAnnualBenefit).toBeCloseTo(3639169-1000000,4);
  expect(priced.assumedRoiPercent).toBeLessThan(upper.upperBoundRoiPercent!);
  expect(priced.assumedNpv).toBeLessThan(upper.upperBoundNpv!);
  expect(priced.assumedTco).toBeCloseTo((upper.assumedTco??(4240000+5*(260831+900000)))+5000000,4);
  expect(priced.assumedPaybackYears).toBeGreaterThan(0);
 });
 it('treats an explicitly entered zero as an assumption, not a proven full-capacity result',()=>{
  const r=evaluateConditionalFinancials(createScenario('factory'),simulated,finance,0);
  expect(r.annualShortfall).toBe(850);
  expect(r.assumedRoiPercent).toBe(r.upperBoundRoiPercent);
  expect(r.assumedNpv).toBe(r.upperBoundNpv);
 });
 it('does not conjure benefits without baseline financial data',()=>{
  const r=evaluateConditionalFinancials(createScenario('factory'),simulated,{...finance,baselineCostAnnual:0},0);
  expect(r.financiallySpecified).toBe(false);
  expect(r.upperBoundRoiPercent).toBeNull();
  expect(r.assumedRoiPercent).toBeNull();
 });
 it('does not accept negative annual costs',()=>{
  expect(()=>evaluateConditionalFinancials(createScenario('factory'),simulated,finance,-3)).toThrow();
 });
});
