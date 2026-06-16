import { PEOPLE } from "./board-store.js";

export function buildSampleTasks(T) {
  const tasks = [
    T("Derichebourg pilot - sorting robot", "ia", { p: "high", d: "2026-07-10", open: true, c: [
      T("Integrate RS03 drive motors", "sk", { p: "high", d: "2026-06-16", s: "l", open: true, c: [
        T("Mount RS03 motors and couplers", "sk", { done: true, d: "2026-06-08", s: "m" }),
        T("Wire motor CAN bus to controller", "sk", { d: "2026-06-14", s: "m" }),
        T("Calibrate RS03 torque limits", "sk", { d: "2026-06-17", s: "s" }),
      ] }),
      T("Tune obstacle avoidance for the sorting line", "ak", { p: "high", d: "2026-06-19", s: "l", open: true, c: [
        T("Collect depth data along the conveyor", "ak", { done: true, d: "2026-06-10", s: "m" }),
        T("Train avoidance model", "ak", { d: "2026-06-18", s: "l" }),
        T("Field test near the conveyor", "ak", { d: "2026-06-22", s: "m" }),
      ] }),
      T("Fix D-Wave board brownout under load", "ly", { p: "high", d: "2026-06-12", s: "m", open: true, c: [
        T("Diagnose the power regulator", "ly", { done: true, d: "2026-06-11", s: "s" }),
        T("Replace regulator and retest", "ly", { d: "2026-06-13", s: "m" }),
      ] }),
      T("Approve motor procurement budget", "jn", { d: "2026-06-15", s: "s" }),
      T("Coordinate on-site pilot install", "fd", { d: "2026-06-30", s: "l" }),
    ] }),

    T("JCDecaux pilot - billboard servicing", "ak", { p: "high", d: "2026-07-20", open: true, c: [
      T("Design board-mount manipulator arm", "ia", { d: "2026-06-23", s: "l", open: true, c: [
        T("CAD the arm linkage", "ia", { d: "2026-06-18", s: "m" }),
        T("Source Feetech servos for the arm", "lm", { d: "2026-06-20", s: "s" }),
      ] }),
      T("Autonomous navigation between billboards", "ak", { p: "high", d: "2026-06-26", s: "xl", open: true, c: [
        T("Build city route planner", "ak", { d: "2026-06-24", s: "l" }),
        T("GPS waypoint following", "ak", { d: "2026-06-25", s: "m" }),
      ] }),
      T("Hub-motor sizing for outdoor terrain", "sk", { d: "2026-06-20", s: "m" }),
      T("Demo prep for JCDecaux", "fd", { d: "2026-06-27", s: "s" }),
    ] }),

    T("Onet pilot - floor-cleaning autonomy", "ak", { d: "2026-08-01", open: true, c: [
      T("Map the Onet facility floorplan", "ak", { d: "2026-06-21", s: "m" }),
      T("Integrate Feetech servos for the brush arm", "sk", { d: "2026-06-24", s: "m", open: true, c: [
        T("Mount the brush assembly", "lm", { d: "2026-06-22", s: "s" }),
        T("Tune servo sweep pattern", "sk", { d: "2026-06-25", s: "s" }),
      ] }),
      T("Safety e-stop wiring", "ly", { p: "high", d: "2026-06-16", s: "s" }),
    ] }),

    T("RoboOS v2 - core platform", "ia", { p: "high", d: "2026-07-31", open: true, c: [
      T("Migrate OS to RS04 motor drivers", "sk", { p: "high", d: "2026-06-24", s: "l", open: true, c: [
        T("Port CAN driver to RS04", "sk", { d: "2026-06-22", s: "m" }),
        T("Bench-test RS04 closed loop", "sk", { d: "2026-06-23", s: "m" }),
      ] }),
      T("Real-time locomotion controller", "ak", { d: "2026-06-29", s: "l" }),
      T("Evaluate EL05 actuators", "sk", { d: "2026-06-17", s: "m", open: true, c: [
        T("Run EL05 load tests", "sk", { done: true, d: "2026-06-09", s: "s" }),
        T("Compare EL05 vs RS02 efficiency", "sk", { d: "2026-06-18", s: "s" }),
      ] }),
      T("Nightly build + hardware-in-the-loop rig", "ia", { d: "2026-06-21", s: "m" }),
      T("Assemble robot chassis v2", "ia", { d: "2026-07-06", s: "l" }),
    ] }),

    T("NSI pilot - inventory scanning", "ia", { d: "2026-07-15", open: true, c: [
      T("Scoping follow-up with NSI", "fd", { d: "2026-06-19", s: "s" }),
      T("Barcode scanner integration", "sk", { d: "2026-06-28", s: "m" }),
      T("Aisle navigation tuning", "ak", { d: "2026-07-02", s: "m" }),
    ] }),
  ];

  sprinkleSubtaskOwners(tasks);
  return tasks;
}

function sprinkleSubtaskOwners(nodes) {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const keys = Object.keys(PEOPLE);
  const walk = (list, parent, depth) => list.forEach((n) => {
    if (depth >= 2 && parent) {
      n.owner = rnd() < 0.7 ? parent.owner : keys[Math.floor(rnd() * keys.length)];
    }
    walk(n.children, n, depth + 1);
  });
  walk(nodes, null, 0);
}
