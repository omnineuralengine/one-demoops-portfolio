#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadComparisonState, runRadar, writeRadarArtifacts } from "./change-radar/orchestrator.ts";
export async function runChangeRadar(){const root=resolve(import.meta.dirname,"..");const result=await runRadar({previous:await loadComparisonState(root)});await writeRadarArtifacts(root,result);console.log(`Change Radar complete: ${result.events.length} reviewable events; ${result.health.filter((item)=>item.stage!=="HEALTHY").length} unhealthy sources.`);if(result.health.every((item)=>item.stage!=="HEALTHY"))process.exitCode=1;return result;}
const invoked=process.argv[1]?pathToFileURL(resolve(process.argv[1])).href:null;if(invoked===import.meta.url)runChangeRadar().catch((error)=>{console.error(error instanceof Error?error.message:"Change Radar failed.");process.exitCode=1;});
